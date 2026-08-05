/**
 * Pre-dev/pre-build hook: run the full data pipeline when the generated
 * catalog is missing, so `npm run dev` and `npm run build` work out of the box.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  IMPORT_ERRORS_JSON,
  LIBRARY_INDEX_JSON,
  PROJECT_ROOT,
  RULES_JSON,
  SOURCE_METADATA_JSON,
  STATS_JSON,
} from './util';

const required = [RULES_JSON, STATS_JSON, IMPORT_ERRORS_JSON, SOURCE_METADATA_JSON, LIBRARY_INDEX_JSON];

if (required.every((path) => existsSync(path))) {
  console.log('[ensure-data] generated catalog present, skipping data pipeline');
  process.exit(0);
}

console.log('[ensure-data] generated catalog missing — running `npm run data`...');
const result = spawnSync('npm', ['run', 'data'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
