/**
 * Site-wide interactive behaviors (theme toggle, copy, download, share),
 * implemented with event delegation and loaded as one shared external module
 * from BaseLayout. Kept external (not inline) so the strict CSP
 * (`script-src 'self'`) applies to every script on the site.
 */

function flashLabel(container: Element, selector: string, message: string): void {
  const label = container.querySelector(selector);
  if (!label) return;
  const original = label.textContent;
  label.textContent = message;
  setTimeout(() => {
    label.textContent = original;
  }, 1500);
}

document.addEventListener('click', (event) => {
  const target = event.target as Element | null;
  if (!target) return;

  const themeToggle = target.closest<HTMLButtonElement>('[data-theme-toggle]');
  if (themeToggle) {
    const dark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {
      /* private browsing: theme just won't persist */
    }
    return;
  }

  const copyButton = target.closest<HTMLButtonElement>('[data-copy-button]');
  if (copyButton) {
    const selector = copyButton.dataset.copySource;
    const source = selector ? document.querySelector(selector) : null;
    const text = copyButton.dataset.copyText ?? source?.textContent ?? '';
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => flashLabel(copyButton, '[data-copy-label]', 'Copied!'))
      .catch(() => {
        /* clipboard unavailable (permissions) */
      });
    return;
  }

  const downloadButton = target.closest<HTMLButtonElement>('[data-download-yaml]');
  if (downloadButton) {
    const code = document.querySelector('#raw-yaml-code');
    const text = code?.textContent;
    if (!text) return;
    const blob = new Blob([text], { type: 'application/x-yaml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = downloadButton.dataset.downloadName ?? 'sigma-rule.yml';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const shareButton = target.closest<HTMLButtonElement>('[data-share-button]');
  if (shareButton) {
    const url = window.location.href;
    const title = shareButton.dataset.shareTitle ?? document.title;
    const copyFallback = () =>
      navigator.clipboard
        .writeText(url)
        .then(() => flashLabel(shareButton, '[data-share-label]', 'Link copied!'))
        .catch(() => {
          /* clipboard unavailable */
        });
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => copyFallback());
    } else {
      void copyFallback();
    }
  }
});
