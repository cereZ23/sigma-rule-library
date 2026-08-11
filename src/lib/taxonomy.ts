/**
 * Taxonomy helpers for the static SEO landing pages (per MITRE technique,
 * product, logsource category and severity level). Pure logic + URL helpers,
 * shared by the taxonomy pages and the internal links that point at them.
 */
import type { SigmaRule } from './sigma';

/** URL-safe slug for a taxonomy value (product/category/level). */
export function taxonomySlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Base technique id (T1059 from T1059.001). */
export function baseTechnique(id: string): string {
  return id.split('.')[0]!.toUpperCase();
}

export function techniquePath(id: string): string {
  return `/mitre/${baseTechnique(id)}/`;
}
export function productPath(product: string): string {
  return `/product/${taxonomySlug(product)}/`;
}
export function logsourcePath(category: string): string {
  return `/logsource/${taxonomySlug(category)}/`;
}
export function levelPath(level: string): string {
  return `/level/${taxonomySlug(level)}/`;
}

export interface RuleCardData {
  slug: string;
  title: string;
  description?: string;
  level?: string;
  product?: string;
  note?: string;
}

const LEVEL_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

/** Listing order: most severe first, then alphabetical. */
export function sortForListing(rules: SigmaRule[]): SigmaRule[] {
  return [...rules].sort(
    (a, b) =>
      (LEVEL_RANK[b.level ?? ''] ?? 0) - (LEVEL_RANK[a.level ?? ''] ?? 0) ||
      a.title.localeCompare(b.title),
  );
}

export function toCard(rule: SigmaRule, note?: string): RuleCardData {
  return {
    slug: rule.slug,
    title: rule.title,
    description: rule.description,
    level: rule.level,
    product: rule.logsource.product ?? undefined,
    note,
  };
}

/** Top values of a field across a set of rules, most frequent first. */
export function topValues(
  rules: SigmaRule[],
  pick: (rule: SigmaRule) => string | undefined | null,
  limit = 6,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const rule of rules) {
    const value = pick(rule);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/** Group rules into taxonomy buckets keyed by slug (collisions merge). */
export function groupBySlug(
  rules: SigmaRule[],
  pick: (rule: SigmaRule) => string | undefined | null,
): Map<string, { display: string; rules: SigmaRule[] }> {
  const groups = new Map<string, { display: string; rules: SigmaRule[] }>();
  for (const rule of rules) {
    const value = pick(rule);
    if (!value) continue;
    const slug = taxonomySlug(value);
    if (!slug) continue;
    const bucket = groups.get(slug);
    if (bucket) bucket.rules.push(rule);
    else groups.set(slug, { display: value, rules: [rule] });
  }
  return groups;
}
