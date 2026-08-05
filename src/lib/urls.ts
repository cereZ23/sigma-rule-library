/**
 * Base-path aware URL helpers (SPEC §14). Every internal link and asset
 * reference must be built with these so the site works both at the domain
 * root and as a GitHub Pages project page.
 */

/** Join a base path and a site-relative path: joinBase('/repo', '/library') -> '/repo/library'. */
export function joinBase(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}` || '/';
}

/** Absolute canonical URL for a site-relative path. */
export function canonicalUrl(siteOrigin: string, base: string, path: string): string {
  const origin = siteOrigin.replace(/\/+$/, '');
  return `${origin}${joinBase(base, path)}`;
}

/** Site-relative path of a rule detail page. */
export function rulePath(slug: string): string {
  return `/rules/${slug}/`;
}

/** Library URL with pre-applied filters, e.g. libraryPath({ technique: 'T1059' }). */
export function libraryPath(params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params).toString();
  return qs ? `/library/?${qs}` : '/library/';
}
