/**
 * Sigma rule model and pure parsing logic (SPEC §4).
 *
 * Everything here is side-effect free so it can be unit-tested with fixture
 * YAML. File-system walking and JSON output live in scripts/parse-sigma.ts.
 */
import { parseAllDocuments } from 'yaml';
import { extractMitre } from './mitre';
import { shortHash, slugForRule } from './slug';

export interface SigmaLogsource {
  category?: string;
  product?: string;
  service?: string;
  definition?: string;
}

export interface SigmaRelated {
  id: string;
  type: string;
}

export interface SigmaRule {
  slug: string;
  title: string;
  id?: string;
  description?: string;
  status?: string;
  level?: string;
  author: string[];
  date?: string;
  modified?: string;

  ruleType: string;
  repositorySection: string;

  logsource: SigmaLogsource;

  mitreTactics: string[];
  mitreTechniques: string[];
  mitreSubTechniques: string[];

  tags: string[];
  references: string[];
  falsePositives: string[];
  fields: string[];
  related: SigmaRelated[];
  license?: string;
  scope?: string[];

  detection: unknown;
  rawYaml: string;

  sourcePath: string;
  githubUrl: string;
  rawUrl: string;
  sourceCommit: string;

  searchText: string;
}

export interface RuleContext {
  /** Path of the file relative to the SigmaHQ repository root. */
  sourcePath: string;
  /** Human-readable label of the repository section (e.g. "Threat Hunting"). */
  repositorySection: string;
  sourceCommit: string;
  /** "owner/name" of the source repository. */
  repo: string;
}

export interface FileParseResult {
  rules: SigmaRule[];
  errors: string[];
}

/** Normalize a value that may be a string, a list of strings, or garbage. */
export function toStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string | number | boolean => item != null && typeof item !== 'object')
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'object') return [];
  const single = String(value).trim();
  return single ? [single] : [];
}

/** Sigma authors are either a list or a comma-separated string. */
export function parseAuthors(value: unknown): string[] {
  return toStringArray(value)
    .flatMap((author) => author.split(','))
    .map((author) => author.trim())
    .filter((author) => author.length > 0);
}

/**
 * Normalize a Sigma date to YYYY-MM-DD when it matches a known pattern
 * (YYYY/MM/DD or YYYY-MM-DD); otherwise return the raw trimmed string.
 * YAML is parsed with the core schema, so dates always arrive as strings
 * and are never coerced by the YAML parser (SPEC §4).
 */
export function normalizeDate(value: unknown): string | undefined {
  if (value == null) return undefined;
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
  if (!raw) return undefined;
  const match = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return raw;
  return `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`;
}

/** Recursively collect scalar values from the detection block for search indexing. */
export function collectDetectionText(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 12 || value == null) return out;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    if (text) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectDetectionText(item, out, depth + 1);
    return out;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out.push(key);
      collectDetectionText(item, out, depth + 1);
    }
  }
  return out;
}

/** Space-separated, lowercased, de-duplicated token string used for substring search (SPEC §7). */
export function buildSearchText(rule: Omit<SigmaRule, 'searchText'>): string {
  const parts: string[] = [
    rule.title,
    rule.description ?? '',
    rule.id ?? '',
    ...rule.author,
    ...rule.tags,
    ...rule.mitreTechniques,
    ...rule.mitreSubTechniques,
    ...rule.mitreTactics,
    rule.logsource.product ?? '',
    rule.logsource.service ?? '',
    rule.logsource.category ?? '',
    rule.sourcePath,
    ...collectDetectionText(rule.detection),
    ...rule.falsePositives,
  ];
  const tokens = new Set<string>();
  for (const part of parts) {
    for (const token of part.toLowerCase().split(/\s+/)) {
      if (token) tokens.add(token);
    }
  }
  return [...tokens].join(' ');
}

function parseLogsource(value: unknown): SigmaLogsource {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const pick = (key: string): string | undefined => {
    const raw = source[key];
    return raw == null || typeof raw === 'object' ? undefined : String(raw).trim() || undefined;
  };
  return {
    category: pick('category'),
    product: pick('product'),
    service: pick('service'),
    definition: pick('definition'),
  };
}

function parseRelated(value: unknown): SigmaRelated[] {
  if (!Array.isArray(value)) return [];
  const related: SigmaRelated[] = [];
  for (const entry of value) {
    if (entry == null || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const id = record.id == null ? '' : String(record.id).trim();
    if (!id) continue;
    related.push({ id, type: record.type == null ? 'related' : String(record.type).trim() });
  }
  return related;
}

function detectRuleType(doc: Record<string, unknown>): string {
  if (doc.correlation != null) return 'correlation';
  if (doc.filter != null) return 'filter';
  if (doc.action != null) return 'collection';
  return 'detection';
}

/**
 * Build a SigmaRule from one parsed YAML document. Throws with a descriptive
 * message when the document cannot be represented as a rule.
 */
export function buildRule(docValue: unknown, rawYaml: string, ctx: RuleContext): SigmaRule {
  if (docValue == null || typeof docValue !== 'object' || Array.isArray(docValue)) {
    throw new Error('YAML document is not a mapping');
  }
  const doc = docValue as Record<string, unknown>;

  const title = doc.title == null ? '' : String(doc.title).trim();
  if (!title) throw new Error('missing required field: title');

  const ruleType = detectRuleType(doc);
  if (doc.detection == null && ruleType === 'detection') {
    throw new Error('missing required field: detection');
  }

  const id = doc.id == null ? undefined : String(doc.id).trim() || undefined;
  const tags = toStringArray(doc.tags);
  const mitre = extractMitre(tags);

  const base: Omit<SigmaRule, 'searchText'> = {
    slug: slugForRule(id, title, ctx.sourcePath),
    title,
    id,
    description: doc.description == null ? undefined : String(doc.description).trim() || undefined,
    status: doc.status == null ? undefined : String(doc.status).trim().toLowerCase() || undefined,
    level: doc.level == null ? undefined : String(doc.level).trim().toLowerCase() || undefined,
    author: parseAuthors(doc.author),
    date: normalizeDate(doc.date),
    modified: normalizeDate(doc.modified),
    ruleType,
    repositorySection: ctx.repositorySection,
    logsource: parseLogsource(doc.logsource),
    mitreTactics: mitre.tactics,
    mitreTechniques: mitre.techniques,
    mitreSubTechniques: mitre.subTechniques,
    tags,
    references: toStringArray(doc.references),
    falsePositives: toStringArray(doc.falsepositives),
    fields: toStringArray(doc.fields),
    related: parseRelated(doc.related),
    license: doc.license == null ? undefined : String(doc.license).trim() || undefined,
    scope: toStringArray(doc.scope),
    detection: doc.detection ?? doc.correlation ?? null,
    rawYaml,
    sourcePath: ctx.sourcePath,
    githubUrl: `https://github.com/${ctx.repo}/blob/${ctx.sourceCommit}/${ctx.sourcePath}`,
    rawUrl: `https://raw.githubusercontent.com/${ctx.repo}/${ctx.sourceCommit}/${ctx.sourcePath}`,
    sourceCommit: ctx.sourceCommit,
  };

  return { ...base, searchText: buildSearchText(base) };
}

export interface DuplicateReport {
  duplicateIds: { id: string; files: string[] }[];
  duplicateSlugs: { slug: string; files: string[] }[];
}

/**
 * Detect duplicate Sigma IDs across the catalog and force slug uniqueness
 * (SPEC §4): a colliding slug gets the short path hash appended so every
 * rule keeps a stable, unique URL. Mutates the rules in place.
 */
export function resolveDuplicates(rules: SigmaRule[]): DuplicateReport {
  const byId = new Map<string, string[]>();
  for (const rule of rules) {
    if (!rule.id) continue;
    byId.set(rule.id, [...(byId.get(rule.id) ?? []), rule.sourcePath]);
  }
  const duplicateIds = [...byId.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([id, files]) => ({ id, files }));

  const seenSlugs = new Map<string, string>();
  const duplicateSlugs: { slug: string; files: string[] }[] = [];
  for (const rule of rules) {
    const existing = seenSlugs.get(rule.slug);
    if (existing) {
      duplicateSlugs.push({ slug: rule.slug, files: [existing, rule.sourcePath] });
      rule.slug = `${rule.slug}-${shortHash(rule.sourcePath)}`;
    }
    seenSlugs.set(rule.slug, rule.sourcePath);
  }
  return { duplicateIds, duplicateSlugs };
}

/**
 * Parse the raw text of one Sigma YAML file into zero or more rules.
 * Never throws: malformed content is reported through `errors` so a single
 * corrupt file can never break the build (SPEC §4).
 */
export function parseSigmaFile(rawYaml: string, ctx: RuleContext): FileParseResult {
  const result: FileParseResult = { rules: [], errors: [] };

  let documents;
  try {
    // Core schema (YAML 1.2): no timestamp type, dates stay strings.
    documents = parseAllDocuments(rawYaml, { schema: 'core', uniqueKeys: false });
  } catch (error) {
    result.errors.push(`YAML parse failure: ${(error as Error).message}`);
    return result;
  }

  if (documents.length === 0) {
    result.errors.push('file contains no YAML documents');
    return result;
  }

  for (const [index, document] of documents.entries()) {
    const label = documents.length > 1 ? `document ${index + 1}: ` : '';
    if (document.errors.length > 0) {
      result.errors.push(`${label}${document.errors[0]!.message.split('\n')[0]}`);
      continue;
    }
    let value: unknown;
    try {
      value = document.toJS();
    } catch (error) {
      result.errors.push(`${label}cannot convert YAML to object: ${(error as Error).message}`);
      continue;
    }
    if (value == null) continue; // empty document, not an error
    try {
      result.rules.push(buildRule(value, rawYaml, ctx));
    } catch (error) {
      result.errors.push(`${label}${(error as Error).message}`);
    }
  }

  if (result.rules.length === 0 && result.errors.length === 0) {
    result.errors.push('file contains no Sigma rule documents');
  }
  return result;
}
