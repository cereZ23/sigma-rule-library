/**
 * Validate the generated catalog against schemas and quality thresholds
 * (SPEC §19). Fails the build when: no rules were imported, the parse error
 * rate exceeds MAX_ERROR_RATE, or any generated file violates its schema.
 * Also publishes source-metadata.json to public/ so the sync workflow can
 * compare the deployed commit against upstream.
 */
import { z } from 'zod';
import { MAX_ERROR_RATE } from '../config/sigma-sources';
import { resolve } from 'node:path';
import {
  IMPORT_ERRORS_JSON,
  LIBRARY_INDEX_JSON,
  PUBLIC_DIR,
  RULES_JSON,
  SOURCE_METADATA_JSON,
  STATS_JSON,
  readJson,
  writeJson,
} from './util';

const ruleSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  id: z.string().optional(),
  author: z.array(z.string()),
  ruleType: z.string().min(1),
  repositorySection: z.string().min(1),
  logsource: z.object({
    category: z.string().optional(),
    product: z.string().optional(),
    service: z.string().optional(),
    definition: z.string().optional(),
  }),
  mitreTactics: z.array(z.string()),
  mitreTechniques: z.array(z.string()),
  mitreSubTechniques: z.array(z.string()),
  tags: z.array(z.string()),
  references: z.array(z.string()),
  falsePositives: z.array(z.string()),
  rawYaml: z.string().min(1),
  sourcePath: z.string().min(1),
  githubUrl: z.url(),
  rawUrl: z.url(),
  sourceCommit: z.string().min(7),
  searchText: z.string().min(1),
});

const libraryRecordSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  level: z.string().min(1),
  status: z.string().min(1),
  section: z.string().min(1),
  search: z.string().min(1),
});

const metadataSchema = z.object({
  repo: z.string().min(1),
  branch: z.string().min(1),
  commit: z.string().min(7),
  syncedAt: z.string().min(1),
});

const statsSchema = z.object({
  totalRules: z.number().int().positive(),
  sourceCommit: z.string().min(7),
  byLevel: z.record(z.string(), z.number()),
  byStatus: z.record(z.string(), z.number()),
  byProduct: z.record(z.string(), z.number()),
});

const importErrorsSchema = z.object({
  totalFiles: z.number().int().nonnegative(),
  importedRules: z.number().int().nonnegative(),
  failedFiles: z.number().int().nonnegative(),
  errors: z.array(z.object({ file: z.string(), reason: z.string() })),
});

const failures: string[] = [];

const rules = readJson<unknown[]>(RULES_JSON);
const index = readJson<unknown[]>(LIBRARY_INDEX_JSON);
const metadata = readJson<unknown>(SOURCE_METADATA_JSON);
const stats = readJson<unknown>(STATS_JSON);
const importErrors = readJson<z.infer<typeof importErrorsSchema>>(IMPORT_ERRORS_JSON);

// Schema validation
for (const [i, rule] of rules.entries()) {
  const parsed = ruleSchema.safeParse(rule);
  if (!parsed.success) {
    failures.push(`rules.json[${i}]: ${parsed.error.issues[0]?.message} (${parsed.error.issues[0]?.path.join('.')})`);
    if (failures.length > 10) break;
  }
}
for (const [i, record] of index.entries()) {
  const parsed = libraryRecordSchema.safeParse(record);
  if (!parsed.success) {
    failures.push(`library-index.json[${i}]: ${parsed.error.issues[0]?.message}`);
    if (failures.length > 10) break;
  }
}
if (!metadataSchema.safeParse(metadata).success) failures.push('source-metadata.json: invalid schema');
if (!statsSchema.safeParse(stats).success) failures.push('stats.json: invalid schema');
if (!importErrorsSchema.safeParse(importErrors).success) failures.push('import-errors.json: invalid schema');

// Quality thresholds
if (rules.length === 0) failures.push('no rules were imported');
if (rules.length !== index.length) {
  failures.push(`rules.json (${rules.length}) and library-index.json (${index.length}) disagree`);
}
const errorRate = importErrors.totalFiles > 0 ? importErrors.failedFiles / importErrors.totalFiles : 0;
if (errorRate > MAX_ERROR_RATE) {
  failures.push(
    `parse error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(MAX_ERROR_RATE * 100).toFixed(2)}%`,
  );
}

// Duplicate slugs must never survive (they would collide as page routes)
const slugs = new Set<string>();
for (const rule of rules as { slug: string }[]) {
  if (slugs.has(rule.slug)) failures.push(`duplicate slug in catalog: ${rule.slug}`);
  slugs.add(rule.slug);
}

if (failures.length > 0) {
  console.error('[validate] generated data is invalid:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

// Publish metadata (+ counts) for the sync workflow and the About page
writeJson(
  resolve(PUBLIC_DIR, 'source-metadata.json'),
  {
    ...(metadata as Record<string, unknown>),
    totalRules: rules.length,
    failedFiles: importErrors.failedFiles,
  },
  true,
);

console.log(
  `[validate] OK — ${rules.length} rules, ${importErrors.failedFiles}/${importErrors.totalFiles} files failed ` +
    `(${(errorRate * 100).toFixed(2)}% ≤ ${(MAX_ERROR_RATE * 100).toFixed(2)}%)`,
);
