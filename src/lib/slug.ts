/** Stable slug generation for rule URLs (SPEC §5). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Lowercase, ASCII-ish slug from an arbitrary title. */
export function slugifyTitle(title: string): string {
  return (
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || 'untitled'
  );
}

/** Deterministic 8-hex-char FNV-1a hash, used to disambiguate slugs by source path. */
export function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Slug for a rule: the Sigma UUID when available, otherwise
 * `<title-slug>-<short-path-hash>` (never the bare title, SPEC §5).
 */
export function slugForRule(id: string | undefined, title: string, sourcePath: string): string {
  if (id && isUuid(id)) return id.trim().toLowerCase();
  return `${slugifyTitle(title)}-${shortHash(sourcePath)}`;
}
