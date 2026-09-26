// Applies the saved theme before first paint to avoid a flash of the wrong theme.
// Kept as an external file because the Content Security Policy forbids inline scripts.
(function () {
  var theme = 'dark';
  try {
    theme = localStorage.getItem('notedoco:theme') || 'dark';
  } catch {
    /* storage unavailable: use the default */
  }
  var dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
