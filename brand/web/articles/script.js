/* =========================================================
   ARTICLES — Human AI Marketing
   Reading progress, TOC scrollspy, and the chart hover layer.
   ========================================================= */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ===== Year stamp =====
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  // ===== Reading progress =====
  const progressBar = $('.progress span');
  if (progressBar) {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      progressBar.style.width = pct + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ===== TOC scrollspy =====
  const tocLinks = $$('.toc ol a');
  const sections = tocLinks
    .map(a => {
      const el = document.getElementById(a.getAttribute('href').slice(1));
      return el ? { el, link: a } : null;
    })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          tocLinks.forEach(l => l.classList.remove('is-active'));
          const match = sections.find(s => s.el === entry.target);
          if (match) match.link.classList.add('is-active');
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    sections.forEach(s => observer.observe(s.el));
  }

  // ===== Chart hover layer =====
  // Tooltips enhance; they never gate. Every value shown here is also
  // printed as a direct end-label and repeated in the ledger table.
  $$('.figure__frame').forEach(frame => {
    const svg = $('.chart', frame);
    const tip = $('.chart-tip', frame);
    if (!svg || !tip) return;

    const hits = $$('.chart__hit', svg);
    if (!hits.length) return;

    const crosshair = $('.chart__crosshair', svg);

    const show = (hit) => {
      const { year, price, ref, cx } = hit.dataset;

      let html = `<span class="chart-tip__year">${year}</span>`;
      html += `<span class="chart-tip__row"><span class="chart-tip__swatch"></span>` +
              `<span>Squarespace <b class="chart-tip__val">${price}</b></span></span>`;
      if (ref) {
        html += `<span class="chart-tip__row"><span class="chart-tip__swatch chart-tip__swatch--ref"></span>` +
                `<span>Inflation only <b class="chart-tip__val">${ref}</b></span></span>`;
      }
      tip.innerHTML = html;

      // Map the SVG's user-space x into pixels relative to the frame.
      // Note: SVG elements have no offsetTop/offsetLeft (those are HTMLElement
      // properties), so both axes are measured off bounding rects.
      const frameBox = frame.getBoundingClientRect();
      const box = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const scale = box.width / vb.width;

      const x = (box.left - frameBox.left) + (Number(cx) - vb.x) * scale;
      const y = (box.top - frameBox.top) + 10;

      // Keep the tip inside the card at the first and last year.
      const half = tip.offsetWidth / 2;
      const clamped = Math.max(half + 4, Math.min(x, frameBox.width - half - 4));

      tip.style.left = clamped + 'px';
      tip.style.top = y + 'px';
      tip.classList.add('is-visible');

      if (crosshair) {
        crosshair.setAttribute('x1', cx);
        crosshair.setAttribute('x2', cx);
        crosshair.style.opacity = '1';
      }
    };

    const hide = () => {
      tip.classList.remove('is-visible');
      if (crosshair) crosshair.style.opacity = '0';
    };

    hits.forEach(hit => {
      hit.addEventListener('mouseenter', () => show(hit));
      hit.addEventListener('focus', () => show(hit));
    });

    svg.addEventListener('mouseleave', hide);
    svg.addEventListener('blur', hide, true);
  });
})();
