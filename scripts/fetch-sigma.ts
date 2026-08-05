/**
 * Fetch the SigmaHQ rule repository with a shallow clone (SPEC §3).
 * Reuses the existing clone unless --force is passed or FETCH_FORCE=1.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { SIGMA_BRANCH, SIGMA_CACHE_DIR, SIGMA_REPO } from '../config/sigma-sources';
import { PROJECT_ROOT, SOURCE_METADATA_JSON, writeJson, type SourceMetadata } from './util';

const cacheDir = resolve(PROJECT_ROOT, SIGMA_CACHE_DIR);
const force = process.argv.includes('--force') || process.env.FETCH_FORCE === '1';

function git(args: string[], cwd?: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

if (existsSync(resolve(cacheDir, '.git'))) {
  if (force) {
    console.log(`[fetch-sigma] refreshing existing clone in ${SIGMA_CACHE_DIR}`);
    git(['fetch', '--depth', '1', 'origin', SIGMA_BRANCH], cacheDir);
    git(['reset', '--hard', `origin/${SIGMA_BRANCH}`], cacheDir);
  } else {
    console.log(`[fetch-sigma] reusing existing clone in ${SIGMA_CACHE_DIR} (use --force to refresh)`);
  }
} else {
  rmSync(cacheDir, { recursive: true, force: true });
  console.log(`[fetch-sigma] shallow-cloning ${SIGMA_REPO} (branch ${SIGMA_BRANCH})...`);
  git([
    'clone',
    '--depth',
    '1',
    '--branch',
    SIGMA_BRANCH,
    `https://github.com/${SIGMA_REPO}.git`,
    cacheDir,
  ]);
}

const metadata: SourceMetadata = {
  repo: SIGMA_REPO,
  branch: SIGMA_BRANCH,
  commit: git(['rev-parse', 'HEAD'], cacheDir),
  syncedAt: new Date().toISOString(),
};

writeJson(SOURCE_METADATA_JSON, metadata, true);
console.log(`[fetch-sigma] source at commit ${metadata.commit.slice(0, 12)} (${metadata.syncedAt})`);
