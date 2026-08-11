/** Shared helpers for the RSS feeds (build-time only). */
import type { SigmaRule } from './sigma';

export interface FeedItemData {
  title: string;
  slug: string;
  description: string;
  /** ISO date (YYYY-MM-DD) used as pubDate. */
  date: string;
  level: string;
}

/**
 * Most recently updated rules, newest first. `modified` wins over `date`;
 * rules without any usable date are dropped (RSS needs a valid pubDate).
 */
export function recentRules(
  rules: SigmaRule[],
  { limit = 50, onlyLevel }: { limit?: number; onlyLevel?: string } = {},
): FeedItemData[] {
  return rules
    .filter((rule) => (onlyLevel ? rule.level === onlyLevel : true))
    .map((rule) => ({ rule, date: rule.modified ?? rule.date ?? '' }))
    .filter(({ date }) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort((a, b) => b.date.localeCompare(a.date) || a.rule.title.localeCompare(b.rule.title))
    .slice(0, limit)
    .map(({ rule, date }) => ({
      title: rule.title,
      slug: rule.slug,
      description:
        (rule.description?.replace(/\s+/g, ' ').trim() ||
          `Sigma detection rule "${rule.title}".`) +
        (rule.level ? ` (severity: ${rule.level})` : ''),
      date,
      level: rule.level ?? 'unknown',
    }));
}
