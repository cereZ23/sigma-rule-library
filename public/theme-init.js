/* Runs before first paint (loaded synchronously in <head>) to avoid a theme flash. */
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    /* no-op: default to light */
  }
})();
