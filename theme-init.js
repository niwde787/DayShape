// Runs before styles load so a saved dark theme never flashes a light screen.
(() => {
  let preference='system';
  try {const saved=localStorage.getItem('dayshape-theme');if(['light','dark','system'].includes(saved))preference=saved;}catch{}
  const dark=preference==='dark'||(preference==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.dataset.themePreference=preference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#14211d':'#f7f7ef');
})();
