/**
 * Astro-side wrappers around the pure helpers in urls.ts, bound to the
 * build-time environment. Import these from .astro components; import
 * urls.ts directly from build scripts and tests.
 */
import { joinBase, canonicalUrl } from './urls';

export const SITE_URL = import.meta.env.PUBLIC_SITE_URL ?? 'https://username.github.io';
export const BASE_PATH = import.meta.env.BASE_URL ?? '/';
export const GITHUB_REPOSITORY =
  import.meta.env.PUBLIC_GITHUB_REPOSITORY ?? 'username/sigma-rule-library';

export const SITE_NAME = 'Sigma Rule Library';

/** Base-path aware href for internal links: href('/library/'). */
export function href(path: string): string {
  return joinBase(BASE_PATH, path);
}

/** Absolute canonical URL for a site-relative path. */
export function canonical(path: string): string {
  return canonicalUrl(SITE_URL, BASE_PATH, path);
}
