import { describe, expect, it } from 'vitest';
import { FILTER_DEFS, facetCounts, matchesAllFilters, sortFacetValues } from '@lib/filters';
import type { LibraryRecord } from '@lib/library-types';
import { queryTokens, recordMatchesQuery, sortRecords, stateFromParams, paramsFromState } from '@lib/search';

function record(overrides: Partial<LibraryRecord>): LibraryRecord {
  return {
    slug: 'slug',
    title: 'Title',
    description: '',
    level: 'high',
    status: 'test',
    ruleType: 'detection',
    section: 'Core Rules',
    product: 'windows',
    service: null,
    category: 'process_creation',
    tactics: ['execution'],
    techniques: ['T1059', 'T1059.001'],
    authors: ['Alice'],
    created: '2022-01-01',
    modified: '2023-06-01',
    yearCreated: 2022,
    yearModified: 2023,
    path: 'rules/windows/x.yml',
    search: 'title powershell t1059 t1059.001 windows execution',
    ...overrides,
  };
}

describe('combined filters (SPEC §7)', () => {
  const windowsHigh = record({ slug: 'a' });
  const linuxLow = record({ slug: 'b', product: 'linux', level: 'low', techniques: ['T1027'] });

  it('AND across groups, OR within a group', () => {
    expect(matchesAllFilters(windowsHigh, { product: ['windows'], level: ['high'] })).toBe(true);
    expect(matchesAllFilters(windowsHigh, { product: ['windows'], level: ['low'] })).toBe(false);
    expect(matchesAllFilters(linuxLow, { product: ['windows', 'linux'] })).toBe(true);
  });

  it('empty filters match everything', () => {
    expect(matchesAllFilters(linuxLow, {})).toBe(true);
  });

  it('technique filter matches base techniques and sub-techniques', () => {
    expect(matchesAllFilters(windowsHigh, { technique: ['T1059'] })).toBe(true);
    expect(matchesAllFilters(windowsHigh, { technique: ['T1059.001'] })).toBe(true);
    expect(matchesAllFilters(windowsHigh, { technique: ['T1027'] })).toBe(false);
  });

  it('facet counts exclude a group its own selection', () => {
    const counts = facetCounts([windowsHigh, linuxLow], { product: ['windows'] }, () => true);
    // product counts ignore the product selection itself...
    expect(counts.get('product')!.get('linux')).toBe(1);
    // ...but other groups are constrained by it
    expect(counts.get('level')!.get('low')).toBeUndefined();
    expect(counts.get('level')!.get('high')).toBe(1);
  });

  it('sortFacetValues orders levels by severity and years descending', () => {
    const levels = sortFacetValues('level', [
      ['low', 5],
      ['critical', 1],
      ['high', 9],
    ]);
    expect(levels.map(([v]) => v)).toEqual(['critical', 'high', 'low']);
    const years = sortFacetValues('yearCreated', [
      ['2020', 3],
      ['2024', 1],
    ]);
    expect(years[0]![0]).toBe('2024');
  });

  it('every filter key is unique', () => {
    const keys = FILTER_DEFS.map((def) => def.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('search (SPEC §7)', () => {
  const rec = record({});

  it('is case-insensitive and matches partial words', () => {
    expect(recordMatchesQuery(rec, queryTokens('PowerSh'))).toBe(true);
    // substring semantics: every token may match anywhere inside a word
    expect(recordMatchesQuery(rec, queryTokens('power shell'))).toBe(true);
    expect(recordMatchesQuery(rec, queryTokens('osquery'))).toBe(false);
  });

  it('finds rules by MITRE technique ID', () => {
    expect(recordMatchesQuery(rec, queryTokens('T1059.001'))).toBe(true);
    expect(recordMatchesQuery(rec, queryTokens('t1059'))).toBe(true);
  });

  it('requires every token to match', () => {
    expect(recordMatchesQuery(rec, queryTokens('powershell windows'))).toBe(true);
    expect(recordMatchesQuery(rec, queryTokens('powershell macos'))).toBe(false);
  });

  it('empty query matches everything', () => {
    expect(recordMatchesQuery(rec, queryTokens('  '))).toBe(true);
  });
});

describe('sorting', () => {
  const a = record({ slug: 'a', title: 'Alpha', level: 'low', modified: '2024-01-01' });
  const b = record({ slug: 'b', title: 'Beta', level: 'critical', modified: '2022-01-01' });

  it('sorts by severity, recency and title', () => {
    expect(sortRecords([a, b], 'severity')[0]!.slug).toBe('b');
    expect(sortRecords([a, b], 'modified')[0]!.slug).toBe('a');
    expect(sortRecords([b, a], 'title')[0]!.slug).toBe('a');
  });
});

describe('URL state round-trip (shareable searches)', () => {
  it('decodes the SPEC example URL', () => {
    const state = stateFromParams(new URLSearchParams('q=powershell&product=windows&level=high'));
    expect(state.q).toBe('powershell');
    expect(state.filters).toEqual({ product: ['windows'], level: ['high'] });
  });

  it('round-trips state through params', () => {
    const original = stateFromParams(
      new URLSearchParams('q=lsass&technique=T1003&technique=T1003.001&sort=severity&page=3'),
    );
    const roundTripped = stateFromParams(paramsFromState(original));
    expect(roundTripped).toEqual(original);
  });

  it('ignores invalid sort and page values', () => {
    const state = stateFromParams(new URLSearchParams('sort=nonsense&page=-4'));
    expect(state.sort).toBe('modified');
    expect(state.page).toBe(1);
  });
});
