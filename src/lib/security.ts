/**
 * URL safety helpers (SPEC §16). All external URLs coming from Sigma rule
 * content are untrusted and must pass through here before being rendered
 * as links. Only http(s) is allowed; anything else (javascript:, data:,
 * file:, relative garbage) is rejected.
 */
export function isSafeExternalUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  return url.protocol === 'https:' || url.protocol === 'http:';
}

/** Filter a list of untrusted reference strings down to safe, linkable URLs. */
export function safeReferences(references: string[]): { url: string; safe: boolean }[] {
  return references
    .map((ref) => ref.trim())
    .filter((ref) => ref.length > 0)
    .map((ref) => ({ url: ref, safe: isSafeExternalUrl(ref) }));
}
