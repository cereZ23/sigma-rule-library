/**
 * Library search, sorting and URL state (SPEC §7): pure logic shared by the
 * client-side app and unit tests. Search is case-insensitive substring
 * matching of every query token against the precomputed search text.
 */
import type { LibraryRecord } from './library-types';
import { FILTER_DEFS, type ActiveFilters } from './filters';

export function queryTokens(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export function recordMatchesQuery(record: LibraryRecord, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  return tokens.every((token) => record.search.includes(token));
}

export const SORT_KEYS = ['modified', 'created', 'title', 'severity', 'author', 'path'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  modified: 'Recently modified',
  created: 'Recently created',
  title: 'Title A–Z',
  severity: 'Severity',
  author: 'Author',
  path: 'Repository path',
};

const LEVEL_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

export function sortRecords(records: LibraryRecord[], sort: SortKey): LibraryRecord[] {
  const byTitle = (a: LibraryRecord, b: LibraryRecord) => a.title.localeCompare(b.title);
  const sorted = [...records];
  switch (sort) {
    case 'title':
      return sorted.sort(byTitle);
    case 'modified':
      return sorted.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? '') || byTitle(a, b));
    case 'created':
      return sorted.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? '') || byTitle(a, b));
    case 'severity':
      return sorted.sort(
        (a, b) => (LEVEL_RANK[b.level] ?? 0) - (LEVEL_RANK[a.level] ?? 0) || byTitle(a, b),
      );
    case 'author':
      return sorted.sort(
        (a, b) => (a.authors[0] ?? '￿').localeCompare(b.authors[0] ?? '￿') || byTitle(a, b),
      );
    case 'path':
      return sorted.sort((a, b) => a.path.localeCompare(b.path));
  }
}

export interface LibraryState {
  q: string;
  filters: ActiveFilters;
  sort: SortKey;
  page: number;
}

export const DEFAULT_SORT: SortKey = 'modified';

/** Decode the library state from a URL query string (shareable searches, SPEC §7). */
export function stateFromParams(params: URLSearchParams): LibraryState {
  const filters: ActiveFilters = {};
  for (const def of FILTER_DEFS) {
    const values = params.getAll(def.key).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
    if (values.length > 0) filters[def.key] = [...new Set(values)];
  }
  const sortParam = params.get('sort') as SortKey | null;
  const page = Number(params.get('page') ?? '1');
  return {
    q: params.get('q')?.trim() ?? '',
    filters,
    sort: sortParam && SORT_KEYS.includes(sortParam) ? sortParam : DEFAULT_SORT,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Encode the library state into URL params, omitting defaults to keep URLs clean. */
export function paramsFromState(state: LibraryState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  for (const def of FILTER_DEFS) {
    for (const value of state.filters[def.key] ?? []) params.append(def.key, value);
  }
  if (state.sort !== DEFAULT_SORT) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}
