/* AuraVault — pre-paint theme bootstrap.
 * Runs synchronously in <head> so the correct palette applies on the very
 * first frame (no dark/light flash). Renderer-side companion of the same
 * logic that lives in main.js for the window background color.
 */
(function () {
  try {
    var pref = 'system';
    if (window.vault && typeof window.vault.getThemeSync === 'function') {
      pref = window.vault.getThemeSync();
    } else {
      pref = localStorage.getItem('av.theme') || 'system';
    }
    var dark = pref === 'dark'
      || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-pref', pref);
  } catch (e) { /* fall back to light */ }
})();
