/* =========================================================
   HUMAN · AI · MARKETING — Brand Guide
   Subtle, deliberate interactions only.
   ========================================================= */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ===== Year stamp =====
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  // ===== Scroll progress bar =====
  const progressBar = $('.progress span');
  const masthead = $('.masthead');

  const onScroll = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + '%';

    if (masthead) {
      masthead.classList.toggle('is-scrolled', h.scrollTop > 24);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ===== Side rail scrollspy =====
  const railLinks = $$('.rail a');
  const sections = railLinks
    .map(a => {
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      return el ? { id, el, link: a } : null;
    })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            railLinks.forEach(l => l.classList.remove('is-active'));
            const match = sections.find(s => s.el === entry.target);
            if (match) match.link.classList.add('is-active');
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    );
    sections.forEach(s => observer.observe(s.el));
  }

  // ===== Reveal-on-scroll =====
  const revealTargets = $$('.section, .swatch, .specimen, .value, .example, .pillar, .app, .lockup');
  revealTargets.forEach(el => el.classList.add('reveal'));

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
    );
    revealTargets.forEach(el => revealObserver.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('is-in'));
  }

  // ===== Copy hex on swatch click =====
  const toast = $('#toast');
  let toastTimer = null;

  const showToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1600);
  };

  $$('.swatch').forEach(swatch => {
    swatch.addEventListener('click', async () => {
      const hex = swatch.querySelector('[data-copy]')?.getAttribute('data-copy');
      if (!hex) return;
      try {
        await navigator.clipboard.writeText(hex);
        showToast(`Copied ${hex}`);
      } catch {
        showToast(hex);
      }
    });
  });

  // ===== Smooth section anchor with offset =====
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (href === '#' || href === '#top') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
