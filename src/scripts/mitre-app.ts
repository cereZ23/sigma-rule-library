/**
 * Client-side enhancement of the MITRE coverage page: technique search,
 * covered/uncovered filters, and hiding of tactic sections with no visible
 * techniques. Purely display logic over server-rendered content.
 */
export function initMitreApp(): void {
  const search = document.querySelector<HTMLInputElement>('#mitre-search');
  const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-coverage-mode]')];
  const status = document.querySelector<HTMLElement>('#mitre-filter-status');
  const cells = [...document.querySelectorAll<HTMLElement>('[data-technique-cell]')];
  const sections = [...document.querySelectorAll<HTMLElement>('[data-tactic-section]')];
  if (!search || cells.length === 0) return;

  let mode = 'all';
  let query = '';

  const apply = (): void => {
    let visible = 0;
    for (const cell of cells) {
      const count = Number(cell.dataset.count ?? '0');
      const matchesMode =
        mode === 'all' || (mode === 'covered' ? count > 0 : count === 0);
      const matchesQuery = !query || (cell.dataset.search ?? '').includes(query);
      const show = matchesMode && matchesQuery;
      cell.hidden = !show;
      if (show) visible += 1;
    }
    for (const section of sections) {
      section.hidden =
        section.querySelectorAll('[data-technique-cell]:not([hidden])').length === 0;
    }
    if (status) {
      status.textContent =
        visible === cells.length
          ? ''
          : `${visible} of ${cells.length} techniques shown`;
    }
  };

  let debounce: ReturnType<typeof setTimeout> | undefined;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      query = search.value.trim().toLowerCase();
      apply();
    }, 150);
  });

  for (const button of modeButtons) {
    button.addEventListener('click', () => {
      mode = button.dataset.coverageMode ?? 'all';
      for (const other of modeButtons) {
        const pressed = other === button;
        other.setAttribute('aria-pressed', String(pressed));
        other.classList.toggle('bg-accent', pressed);
        other.classList.toggle('text-accent-fg', pressed);
        other.classList.toggle('bg-surface-elevated', !pressed);
        other.classList.toggle('text-body', !pressed);
      }
      apply();
    });
  }
}
