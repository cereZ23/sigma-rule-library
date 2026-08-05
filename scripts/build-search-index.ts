/**
 * Build the compact client-side search index for the Library page (SPEC §7).
 * Contains only what cards, filters and search need — never rawYaml or the
 * full detection object, which stay build-side in rules.json.
 */
import { gzipSync } from 'node:zlib';
import type { SigmaRule } from '../src/lib/sigma';
import type { LibraryRecord } from '../src/lib/library-types';
import { LIBRARY_INDEX_JSON, RULES_JSON, readJson, writeJson } from './util';

const rules = readJson<SigmaRule[]>(RULES_JSON);

const truncate = (text: string | undefined, max: number): string => {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
};

const yearOf = (date?: string): number | null => {
  const year = date?.match(/^(\d{4})/)?.[1];
  return year ? Number(year) : null;
};

const records: LibraryRecord[] = rules.map((rule) => ({
  slug: rule.slug,
  title: rule.title,
  description: truncate(rule.description, 180),
  level: rule.level ?? 'unknown',
  status: rule.status ?? 'unknown',
  ruleType: rule.ruleType,
  section: rule.repositorySection,
  product: rule.logsource.product ?? null,
  service: rule.logsource.service ?? null,
  category: rule.logsource.category ?? null,
  tactics: rule.mitreTactics,
  techniques: [...rule.mitreTechniques, ...rule.mitreSubTechniques],
  authors: rule.author,
  created: rule.date ?? null,
  modified: rule.modified ?? rule.date ?? null,
  yearCreated: yearOf(rule.date),
  yearModified: yearOf(rule.modified ?? rule.date),
  path: rule.sourcePath,
  search: rule.searchText,
}));

writeJson(LIBRARY_INDEX_JSON, records);
const raw = JSON.stringify(records);
const gzipped = gzipSync(Buffer.from(raw)).length;
console.log(
  `[build-search-index] ${records.length} records, ` +
    `${(raw.length / 1024 / 1024).toFixed(1)} MB raw / ${(gzipped / 1024 / 1024).toFixed(2)} MB gzip ` +
    `(~${Math.round(gzipped / records.length)} B/record over the wire)`,
);
