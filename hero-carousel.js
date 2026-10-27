/* Phone-only, user-controlled carousel. Native scrolling handles touch and trackpads. */
(() => {
  const viewport = document.getElementById('heroCarousel');
  const slides = [...viewport.querySelectorAll('.hero-slide')];
  const buttons = [...document.querySelectorAll('[data-hero-index]')];
  const status = document.querySelector('.hero-slide-status');
  const phone = matchMedia('(max-width: 767px)');
  let selected = 0;
  let previousWidth = 0;

  function update() {
    if (phone.matches) selected = Math.min(1, Math.max(0, Math.round(viewport.scrollLeft / Math.max(1, viewport.clientWidth))));
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === selected)));
    slides.forEach((slide, index) => {
      slide.inert = phone.matches && index !== selected;
      if (phone.matches) {
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'スライド');
        slide.setAttribute('aria-hidden', String(index !== selected));
      } else {
        slide.removeAttribute('role');
        slide.removeAttribute('aria-roledescription');
        slide.removeAttribute('aria-hidden');
      }
    });
    status.textContent = `${selected === 0 ? '実写' : '漫画'}の尚美、${selected + 1} / 2`;
  }

  function go(index) {
    if (!phone.matches) return;
    viewport.scrollTo({left: Math.min(1, Math.max(0, index)) * viewport.clientWidth, behavior: 'instant'});
  }

  function configure() {
    if (phone.matches) {
      viewport.tabIndex = 0;
      viewport.setAttribute('role', 'region');
      viewport.setAttribute('aria-roledescription', 'カルーセル');
      viewport.setAttribute('aria-label', '尚美の実写と漫画');
      viewport.setAttribute('aria-describedby', 'heroSwipeHint');
      go(selected);
    } else {
      viewport.removeAttribute('tabindex');
      ['role', 'aria-roledescription', 'aria-label', 'aria-describedby'].forEach(name => viewport.removeAttribute(name));
    }
    update();
  }

  buttons.forEach((button, index) => button.addEventListener('click', () => go(index)));
  viewport.addEventListener('scroll', update, {passive: true});
  viewport.addEventListener('keydown', event => {
    if (!phone.matches || event.target !== viewport) return;
    const target = {ArrowLeft: selected - 1, ArrowRight: selected + 1, Home: 0, End: 1}[event.key];
    if (target === undefined) return;
    event.preventDefault();
    go(target);
  });
  phone.addEventListener('change', configure);
  new ResizeObserver(() => {
    if (phone.matches && viewport.clientWidth !== previousWidth) {
      previousWidth = viewport.clientWidth;
      go(selected);
      update();
    }
  }).observe(viewport);
  configure();
})();
