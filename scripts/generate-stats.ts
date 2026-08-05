/** Aggregate catalog statistics computed at build time (SPEC §10). */
import type { SigmaRule } from '../src/lib/sigma';
import {
  IMPORT_ERRORS_JSON,
  RULES_JSON,
  SOURCE_METADATA_JSON,
  STATS_JSON,
  readJson,
  writeJson,
  type SourceMetadata,
} from './util';

const rules = readJson<SigmaRule[]>(RULES_JSON);
const importReport = readJson<{ failedFiles: number; errors: unknown[] }>(IMPORT_ERRORS_JSON);
const metadata = readJson<SourceMetadata>(SOURCE_METADATA_JSON);

function countBy(values: (string | undefined)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = value && value.trim() ? value.trim() : 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function top(counts: Record<string, number>, n: number): [string, number][] {
  return Object.entries(counts).slice(0, n);
}

const yearOf = (date?: string): string | undefined => date?.match(/^(\d{4})/)?.[1];

const techniqueCounts = countBy(rules.flatMap((r) => r.mitreTechniques));
const authorCounts = countBy(rules.flatMap((r) => (r.author.length ? r.author : [undefined])));

const recentlyModified = [...rules]
  .filter((r) => r.modified ?? r.date)
  .sort((a, b) => (b.modified ?? b.date ?? '').localeCompare(a.modified ?? a.date ?? ''))
  .slice(0, 8)
  .map((r) => ({
    slug: r.slug,
    title: r.title,
    modified: r.modified ?? r.date ?? null,
    level: r.level ?? 'unknown',
    product: r.logsource.product ?? null,
  }));

const stats = {
  generatedAt: new Date().toISOString(),
  sourceCommit: metadata.commit,
  sourceBranch: metadata.branch,
  sourceRepo: metadata.repo,
  syncedAt: metadata.syncedAt,

  totalRules: rules.length,
  failedFiles: importReport.failedFiles,
  importErrors: importReport.errors.length,

  distinctProducts: new Set(rules.map((r) => r.logsource.product).filter(Boolean)).size,
  distinctTechniques: Object.keys(techniqueCounts).filter((k) => k !== 'unknown').length,
  distinctTactics: new Set(rules.flatMap((r) => r.mitreTactics)).size,
  distinctAuthors: Object.keys(authorCounts).filter((k) => k !== 'unknown').length,

  byLevel: countBy(rules.map((r) => r.level)),
  byStatus: countBy(rules.map((r) => r.status)),
  byProduct: countBy(rules.map((r) => r.logsource.product)),
  byCategory: countBy(rules.map((r) => r.logsource.category)),
  bySection: countBy(rules.map((r) => r.repositorySection)),
  byRuleType: countBy(rules.map((r) => r.ruleType)),

  topAuthors: top(authorCounts, 25),
  topTechniques: top(techniqueCounts, 25),

  createdByYear: Object.fromEntries(
    Object.entries(countBy(rules.map((r) => yearOf(r.date)))).sort((a, b) => a[0].localeCompare(b[0])),
  ),
  modifiedByYear: Object.fromEntries(
    Object.entries(countBy(rules.map((r) => yearOf(r.modified ?? r.date)))).sort((a, b) =>
      a[0].localeCompare(b[0]),
    ),
  ),

  recentlyModified,
};

writeJson(STATS_JSON, stats, true);
console.log(`[generate-stats] wrote stats for ${rules.length} rules`);
