/** Shared helpers for the build-time data pipeline scripts. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const GENERATED_DIR = resolve(PROJECT_ROOT, 'src/generated');
export const PUBLIC_DIR = resolve(PROJECT_ROOT, 'public');

export const RULES_JSON = resolve(GENERATED_DIR, 'rules.json');
export const STATS_JSON = resolve(GENERATED_DIR, 'stats.json');
export const IMPORT_ERRORS_JSON = resolve(GENERATED_DIR, 'import-errors.json');
export const SOURCE_METADATA_JSON = resolve(GENERATED_DIR, 'source-metadata.json');
export const LIBRARY_INDEX_JSON = resolve(GENERATED_DIR, 'library-index.json');

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown, pretty = false): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value));
}

export interface SourceMetadata {
  repo: string;
  branch: string;
  commit: string;
  syncedAt: string;
}
