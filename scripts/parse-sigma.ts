/**
 * Walk the cached SigmaHQ clone, parse every rule file from the enabled
 * sections and write the catalog + import error report (SPEC §3–§5).
 * A malformed file never aborts the run: it is recorded in import-errors.json.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { SIGMA_CACHE_DIR, sigmaSources, sourceSections } from '../config/sigma-sources';
import { parseSigmaFile, resolveDuplicates, type SigmaRule } from '../src/lib/sigma';
import {
  IMPORT_ERRORS_JSON,
  PROJECT_ROOT,
  RULES_JSON,
  SOURCE_METADATA_JSON,
  readJson,
  writeJson,
  type SourceMetadata,
} from './util';

interface ImportError {
  file: string;
  reason: string;
}

const cacheDir = resolve(PROJECT_ROOT, SIGMA_CACHE_DIR);
if (!existsSync(cacheDir)) {
  console.error(`[parse-sigma] missing ${SIGMA_CACHE_DIR} — run \`npm run data:fetch\` first`);
  process.exit(1);
}
const metadata = readJson<SourceMetadata>(SOURCE_METADATA_JSON);

function* walkYamlFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkYamlFiles(path);
    } else if (/\.ya?ml$/i.test(entry.name)) {
      yield path;
    }
  }
}

const rules: SigmaRule[] = [];
const errors: ImportError[] = [];
let totalFiles = 0;

for (const [key, enabled] of Object.entries(sigmaSources)) {
  if (!enabled) continue;
  const section = sourceSections[key as keyof typeof sourceSections];
  const sectionDir = resolve(cacheDir, section.dir);
  if (!existsSync(sectionDir)) {
    console.warn(`[parse-sigma] section directory not found, skipping: ${section.dir}`);
    continue;
  }
  for (const filePath of walkYamlFiles(sectionDir)) {
    totalFiles += 1;
    const sourcePath = relative(cacheDir, filePath).split('\\').join('/');
    let rawYaml: string;
    try {
      rawYaml = readFileSync(filePath, 'utf8');
    } catch (error) {
      errors.push({ file: sourcePath, reason: `unreadable file: ${(error as Error).message}` });
      continue;
    }
    const result = parseSigmaFile(rawYaml, {
      sourcePath,
      repositorySection: section.label,
      sourceCommit: metadata.commit,
      repo: metadata.repo,
    });
    rules.push(...result.rules);
    for (const reason of result.errors) {
      errors.push({ file: sourcePath, reason });
    }
  }
}

// Duplicate detection (SPEC §4): report duplicate Sigma IDs, force slug uniqueness.
const { duplicateIds, duplicateSlugs } = resolveDuplicates(rules);

rules.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

writeJson(RULES_JSON, rules);
writeJson(
  IMPORT_ERRORS_JSON,
  {
    generatedAt: new Date().toISOString(),
    sourceCommit: metadata.commit,
    totalFiles,
    importedRules: rules.length,
    failedFiles: new Set(errors.map((e) => e.file)).size,
    errors,
    duplicateIds,
    duplicateSlugs,
  },
  true,
);

console.log(
  `[parse-sigma] imported ${rules.length} rules from ${totalFiles} files ` +
    `(${errors.length} errors, ${duplicateIds.length} duplicate IDs, ${duplicateSlugs.length} slug collisions)`,
);
