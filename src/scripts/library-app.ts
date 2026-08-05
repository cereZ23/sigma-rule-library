/**
 * Client-side Library application (SPEC §7): loads the prebuilt JSON index,
 * then handles search, combinable filters with counts, sorting, pagination
 * and URL state without any page reload.
 *
 * All rendering uses createElement/textContent — rule content is untrusted
 * and must never reach innerHTML (SPEC §16).
 */
import { FILTER_DEFS, facetCounts, matchesAllFilters, sortFacetValues } from '../lib/filters';
import type { LibraryRecord } from '../lib/library-types';
import {
  DEFAULT_SORT,
  SORT_KEYS,
  SORT_LABELS,
  paramsFromState,
  queryTokens,
  recordMatchesQuery,
  sortRecords,
  stateFromParams,
  type LibraryState,
} from '../lib/search';

const PAGE_SIZE = 24;

const LEVEL_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300',
  high: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  low: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300',
  informational: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function badge(text: string, extra = 'bg-surface-muted text-body-muted'): HTMLElement {
  return el(
    'span',
    `inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${extra}`,
    text,
  );
}

export function initLibraryApp(root: HTMLElement): void {
  const indexUrl = root.dataset.indexUrl!;
  const base = root.dataset.base ?? '/';
  const rulesBase = `${base.replace(/\/+$/, '')}/rules/`;

  const searchInput = document.querySelector<HTMLInputElement>('#library-search')!;
  const sortSelect = document.querySelector<HTMLSelectElement>('#library-sort')!;
  const resultCount = document.querySelector<HTMLElement>('#result-count')!;
  const resultsList = document.querySelector<HTMLUListElement>('#results-list')!;
  const paginationNav = document.querySelector<HTMLElement>('#pagination')!;
  const filterPanel = document.querySelector<HTMLElement>('#filter-panel')!;
  const filterForm = document.querySelector<HTMLFormElement>('#filter-form')!;
  const clearButton = document.querySelector<HTMLButtonElement>('#clear-filters')!;
  const filtersToggle = document.querySelector<HTMLButtonElement>('#filters-toggle')!;
  const filtersClose = document.querySelector<HTMLButtonElement>('#filters-close')!;
  const statusLine = document.querySelector<HTMLElement>('#library-status')!;

  let records: LibraryRecord[] = [];
  let state: LibraryState = stateFromParams(new URLSearchParams(window.location.search));
  searchInput.value = state.q;

  for (const key of SORT_KEYS) {
    const option = el('option', '', SORT_LABELS[key]);
    option.value = key;
    sortSelect.append(option);
  }
  sortSelect.value = state.sort;

  // --- rendering -----------------------------------------------------------

  function ruleCard(record: LibraryRecord): HTMLLIElement {
    const li = el('li');
    const link = el(
      'a',
      'block h-full rounded-lg border border-edge bg-surface-elevated p-4 transition-colors hover:border-edge-strong',
    );
    link.href = `${rulesBase}${record.slug}/`;

    const top = el('div', 'flex items-start justify-between gap-3');
    top.append(el('h3', 'font-medium leading-snug text-body', record.title));
    top.append(
      badge(record.level, LEVEL_BADGE[record.level] ?? 'bg-surface-muted text-body-muted'),
    );
    link.append(top);

    if (record.description) {
      link.append(el('p', 'mt-1.5 line-clamp-2 text-sm text-body-muted', record.description));
    }

    const badges = el('div', 'mt-3 flex flex-wrap gap-1.5');
    badges.append(badge(record.status));
    if (record.product) badges.append(badge(record.product, 'bg-accent-soft text-link'));
    const sourceDetail = record.service ?? record.category;
    if (sourceDetail) badges.append(badge(sourceDetail, 'bg-accent-soft text-link'));
    for (const technique of record.techniques.filter((t) => !t.includes('.')).slice(0, 3)) {
      badges.append(badge(technique, 'bg-surface-muted font-mono text-body-muted'));
    }
    badges.append(badge(record.section));
    link.append(badges);

    const meta: string[] = [];
    if (record.authors.length > 0) meta.push(record.authors[0]! + (record.authors.length > 1 ? ' et al.' : ''));
    if (record.modified) meta.push(`modified ${record.modified}`);
    if (meta.length > 0) link.append(el('p', 'mt-2 text-xs text-body-subtle', meta.join(' · ')));

    li.append(link);
    return li;
  }

  function renderResults(matching: LibraryRecord[]): void {
    const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * PAGE_SIZE;
    const pageRecords = matching.slice(start, start + PAGE_SIZE);

    resultsList.replaceChildren(...pageRecords.map(ruleCard));
    resultCount.textContent = `${matching.length.toLocaleString('en-US')} rule${matching.length === 1 ? '' : 's'} found`;

    paginationNav.replaceChildren();
    if (totalPages > 1) {
      const makeButton = (label: string, page: number, disabled: boolean) => {
        const button = el(
          'button',
          'rounded-md border border-edge bg-surface-elevated px-3 py-1.5 text-sm font-medium text-body enabled:hover:bg-surface-muted disabled:opacity-40',
          label,
        );
        button.type = 'button';
        button.disabled = disabled;
        button.addEventListener('click', () => {
          state.page = page;
          update(false);
          resultsList.closest('section')?.scrollIntoView({ block: 'start' });
        });
        return button;
      };
      paginationNav.append(
        makeButton('← Previous', state.page - 1, state.page <= 1),
        el('span', 'px-2 text-sm text-body-muted', `Page ${state.page} of ${totalPages}`),
        makeButton('Next →', state.page + 1, state.page >= totalPages),
      );
    }

    if (matching.length === 0) {
      const empty = el('li', 'col-span-full rounded-lg border border-edge bg-surface-muted p-8 text-center text-body-muted');
      empty.append(el('p', 'font-medium text-body', 'No rules match the current search.'));
      empty.append(el('p', 'mt-1 text-sm', 'Try removing a filter or using a shorter query.'));
      resultsList.append(empty);
    }
  }

  function renderFilters(tokens: string[]): void {
    const counts = facetCounts(records, state.filters, (r) => recordMatchesQuery(r, tokens));
    const openKeys = new Set(
      [...filterForm.querySelectorAll<HTMLDetailsElement>('details[open]')].map(
        (d) => d.dataset.filterKey!,
      ),
    );
    const firstRender = filterForm.childElementCount === 0;

    const groups = FILTER_DEFS.map((def) => {
      const groupCounts = counts.get(def.key) ?? new Map<string, number>();
      const active = state.filters[def.key] ?? [];
      const entries = sortFacetValues(def.key, [...groupCounts.entries()]).filter(
        ([value, count]) => count > 0 || active.includes(value),
      );
      if (entries.length === 0 && active.length === 0) return null;

      const details = el('details', 'border-b border-edge py-2');
      details.dataset.filterKey = def.key;
      if (firstRender ? active.length > 0 || ['level', 'status', 'product'].includes(def.key) : openKeys.has(def.key)) {
        details.open = true;
      }

      const summary = el(
        'summary',
        'flex cursor-pointer list-none items-center justify-between gap-2 rounded px-1 py-1.5 text-sm font-medium text-body hover:bg-surface-muted',
      );
      summary.append(el('span', '', def.label));
      if (active.length > 0) summary.append(badge(String(active.length), 'bg-accent text-accent-fg'));
      details.append(summary);

      const list = el('div', 'max-h-56 space-y-0.5 overflow-y-auto px-1 pb-2');
      for (const [value, count] of entries) {
        const label = el(
          'label',
          'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-body-muted hover:bg-surface-muted',
        );
        const checkbox = el('input') as HTMLInputElement;
        checkbox.type = 'checkbox';
        checkbox.name = def.key;
        checkbox.value = value;
        checkbox.checked = active.includes(value);
        checkbox.className = 'h-3.5 w-3.5 accent-[var(--sl-accent)]';
        checkbox.addEventListener('change', () => {
          const current = new Set(state.filters[def.key] ?? []);
          if (checkbox.checked) current.add(value);
          else current.delete(value);
          state.filters[def.key] = [...current];
          if (state.filters[def.key]!.length === 0) delete state.filters[def.key];
          state.page = 1;
          update();
        });
        label.append(checkbox);
        label.append(el('span', 'min-w-0 flex-1 truncate', value));
        label.append(el('span', 'text-xs text-body-subtle', String(count)));
        list.append(label);
      }
      details.append(list);
      return details;
    }).filter((group): group is HTMLDetailsElement => group !== null);

    filterForm.replaceChildren(...groups);
  }

  function update(rerenderFilters = true): void {
    const tokens = queryTokens(state.q);
    const matching = sortRecords(
      records.filter((r) => recordMatchesQuery(r, tokens) && matchesAllFilters(r, state.filters)),
      state.sort,
    );
    renderResults(matching);
    if (rerenderFilters) renderFilters(tokens);

    const params = paramsFromState(state).toString();
    const url = params ? `${window.location.pathname}?${params}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }

  // --- events --------------------------------------------------------------

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.q = searchInput.value;
      state.page = 1;
      update();
    }, 200);
  });

  sortSelect.addEventListener('change', () => {
    state.sort = (SORT_KEYS as readonly string[]).includes(sortSelect.value)
      ? (sortSelect.value as LibraryState['sort'])
      : DEFAULT_SORT;
    state.page = 1;
    update(false);
  });

  clearButton.addEventListener('click', () => {
    state = { q: '', filters: {}, sort: state.sort, page: 1 };
    searchInput.value = '';
    update();
  });

  window.addEventListener('popstate', () => {
    state = stateFromParams(new URLSearchParams(window.location.search));
    searchInput.value = state.q;
    sortSelect.value = state.sort;
    update();
  });

  // Mobile filter panel with focus management (SPEC §12)
  const openPanel = () => {
    filterPanel.dataset.open = 'true';
    filtersToggle.setAttribute('aria-expanded', 'true');
    filtersClose.focus();
  };
  const closePanel = (refocus = true) => {
    delete filterPanel.dataset.open;
    filtersToggle.setAttribute('aria-expanded', 'false');
    if (refocus) filtersToggle.focus();
  };
  filtersToggle.addEventListener('click', () => {
    if (filterPanel.dataset.open) closePanel();
    else openPanel();
  });
  filtersClose.addEventListener('click', () => closePanel());
  filterPanel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filterPanel.dataset.open) closePanel();
  });

  // --- boot ----------------------------------------------------------------

  fetch(indexUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<LibraryRecord[]>;
    })
    .then((data) => {
      records = data;
      statusLine.textContent = '';
      update();
    })
    .catch((error: unknown) => {
      statusLine.textContent = `Could not load the rule index (${String(error)}). Try reloading the page.`;
    });
}
