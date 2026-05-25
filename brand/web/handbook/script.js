/* =========================================================
   INTERN HANDBOOK — minimal, deliberate interactions
   ========================================================= */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ===== Year stamp =====
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  // ===== Scroll progress =====
  const progressBar = $('.progress span');
  const onScroll = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + '%';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ===== TOC scrollspy =====
  const tocLinks = $$('.toc a');
  const sections = tocLinks
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
            tocLinks.forEach(l => l.classList.remove('is-active'));
            const match = sections.find(s => s.el === entry.target);
            if (match) match.link.classList.add('is-active');
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    sections.forEach(s => observer.observe(s.el));
  }

  // ===== Highlight comment lines in code blocks =====
  // Wraps any line starting with `#` or `//` in a span so CSS can mute it.
  // Done before copy-button setup so textContent still returns the plain text.
  const escapeHtml = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  $$('.code code').forEach(codeEl => {
    const lines = codeEl.textContent.split('\n');
    const html = lines.map(line => {
      const match = line.match(/^(\s*)(#|\/\/)(.*)$/);
      if (match) {
        const [, lead, marker, rest] = match;
        return `${escapeHtml(lead)}<span class="code-comment">${escapeHtml(marker + rest)}</span>`;
      }
      return escapeHtml(line);
    }).join('\n');
    codeEl.innerHTML = html;
  });

  // ===== Copy buttons for code blocks =====
  const toast = $('#toast');
  let toastTimer = null;

  const showToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1600);
  };

  // ===== Info dialogs (data-dialog="<id>" triggers) =====
  $$('[data-dialog]').forEach(trigger => {
    const id = trigger.getAttribute('data-dialog');
    const dialog = document.getElementById(id);
    if (!dialog) return;

    trigger.addEventListener('click', () => {
      dialog.showModal();
      document.body.classList.add('has-dialog-open');
    });
  });

  $$('dialog.info-dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      document.body.classList.remove('has-dialog-open');
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });

    const closeBtn = dialog.querySelector('[data-close-dialog]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => dialog.close());
    }
  });

  // ===== Slideshow crossfade (auto + manual chip select) =====
  $$('.slideshow').forEach(slideshow => {
    const slides = $$('.slideshow__slide', slideshow);
    const chips = $$('.slideshow__chip', slideshow);
    if (slides.length < 2) return;

    let i = 0;
    let timer;

    const goTo = (idx) => {
      if (idx === i) return;
      slides[i].classList.remove('is-active');
      const prevChip = chips[i];
      if (prevChip) {
        prevChip.classList.remove('is-active');
        prevChip.setAttribute('aria-selected', 'false');
      }
      i = idx;
      slides[i].classList.add('is-active');
      const nextChip = chips[i];
      if (nextChip) {
        nextChip.classList.add('is-active');
        nextChip.setAttribute('aria-selected', 'true');
      }
    };

    const startAuto = () => {
      clearInterval(timer);
      timer = setInterval(() => goTo((i + 1) % slides.length), 5000);
    };

    chips.forEach((chip, idx) => {
      chip.addEventListener('click', () => {
        goTo(idx);
        startAuto();
      });
    });

    startAuto();
  });

  $$('.code').forEach(block => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    block.appendChild(btn);

    btn.addEventListener('click', async () => {
      const codeEl = block.querySelector('code');
      const text = (codeEl ? codeEl.textContent : block.textContent).trim();
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied';
        btn.classList.add('is-copied');
        showToast('Copied to clipboard');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('is-copied');
        }, 1600);
      } catch {
        showToast('Copy failed — select manually');
      }
    });
  });
})();
