/**
 * Combinable library filters (SPEC §7): pure logic shared by the client-side
 * library app and the unit tests. Values within one group are OR-ed,
 * different groups are AND-ed.
 */
import type { LibraryRecord } from './library-types';

export interface FilterDef {
  key: string;
  label: string;
  values: (record: LibraryRecord) => string[];
}

export const FILTER_DEFS: FilterDef[] = [
  { key: 'level', label: 'Level', values: (r) => [r.level] },
  { key: 'status', label: 'Status', values: (r) => [r.status] },
  { key: 'product', label: 'Product', values: (r) => (r.product ? [r.product] : []) },
  { key: 'service', label: 'Service', values: (r) => (r.service ? [r.service] : []) },
  { key: 'category', label: 'Logsource category', values: (r) => (r.category ? [r.category] : []) },
  { key: 'tactic', label: 'ATT&CK tactic', values: (r) => r.tactics },
  { key: 'technique', label: 'ATT&CK technique', values: (r) => r.techniques },
  { key: 'author', label: 'Author', values: (r) => r.authors },
  { key: 'ruleType', label: 'Rule type', values: (r) => [r.ruleType] },
  { key: 'section', label: 'Repository section', values: (r) => [r.section] },
  {
    key: 'yearCreated',
    label: 'Year created',
    values: (r) => (r.yearCreated ? [String(r.yearCreated)] : []),
  },
  {
    key: 'yearModified',
    label: 'Year modified',
    values: (r) => (r.yearModified ? [String(r.yearModified)] : []),
  },
];

/** Active selections per filter key. Missing key or empty array = no constraint. */
export type ActiveFilters = Record<string, string[]>;

export function matchesFilter(record: LibraryRecord, def: FilterDef, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const values = def.values(record);
  return selected.some((wanted) => values.includes(wanted));
}

export function matchesAllFilters(
  record: LibraryRecord,
  active: ActiveFilters,
  defs: FilterDef[] = FILTER_DEFS,
): boolean {
  return defs.every((def) => matchesFilter(record, def, active[def.key] ?? []));
}

/**
 * Faceted counts: for each group, values are counted over the records that
 * match the query and every OTHER group (so a group's own selection never
 * zeroes out its siblings).
 */
export function facetCounts(
  records: LibraryRecord[],
  active: ActiveFilters,
  matchesQuery: (record: LibraryRecord) => boolean,
  defs: FilterDef[] = FILTER_DEFS,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const def of defs) {
    const others = defs.filter((d) => d.key !== def.key);
    const counts = new Map<string, number>();
    for (const record of records) {
      if (!matchesQuery(record)) continue;
      if (!others.every((d) => matchesFilter(record, d, active[d.key] ?? []))) continue;
      for (const value of def.values(record)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    result.set(def.key, counts);
  }
  return result;
}

const LEVEL_ORDER = ['critical', 'high', 'medium', 'low', 'informational', 'unknown'];
const STATUS_ORDER = ['stable', 'test', 'experimental', 'deprecated', 'unsupported', 'unknown'];

/** Display order of facet values within a group. */
export function sortFacetValues(key: string, entries: [string, number][]): [string, number][] {
  if (key === 'level') {
    return [...entries].sort((a, b) => LEVEL_ORDER.indexOf(a[0]) - LEVEL_ORDER.indexOf(b[0]));
  }
  if (key === 'status') {
    return [...entries].sort((a, b) => STATUS_ORDER.indexOf(a[0]) - STATUS_ORDER.indexOf(b[0]));
  }
  if (key === 'yearCreated' || key === 'yearModified') {
    return [...entries].sort((a, b) => b[0].localeCompare(a[0]));
  }
  if (key === 'technique') {
    return [...entries].sort((a, b) => a[0].localeCompare(b[0]));
  }
  return [...entries].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
