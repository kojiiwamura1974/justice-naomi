/* Preserve section deep links while following ordinary, history-aware page links. */
(() => {
  const links = [...document.querySelectorAll('[data-language-switch]')];
  const paths = links.map(link => new URL(link.href).pathname);
  const sync = () => links.forEach((link, i) => { link.href = paths[i] + location.hash; });
  window.addEventListener('hashchange', sync);
  sync();
  window.addEventListener('pageshow', event => {
    if (event.persisted || !location.hash) return;
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (target) requestAnimationFrame(() => target.scrollIntoView({block:'start', behavior:'instant'}));
  });
})();
