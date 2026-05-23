/* Human AI Marketing — Homepage script.
   Progressive enhancement only; the page is fully usable with JS disabled. */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Hero slideshow                                                      */
  /* ------------------------------------------------------------------ */
  const slideshow = document.querySelector(".slideshow");
  if (slideshow) {
    const slides = Array.from(slideshow.querySelectorAll(".slide"));
    const dots = Array.from(document.querySelectorAll(".slideshow__dots .dot"));
    const numEl = document.querySelector("[data-current-num]");
    const cityEl = document.querySelector("[data-current-city]");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const DURATION = 6000;
    document.documentElement.style.setProperty("--slide-duration", DURATION + "ms");

    let current = 0;
    let timer = null;
    let paused = false;

    function show(next, { advance = false } = {}) {
      if (next === current) return;
      slides[current].classList.remove("is-active");
      dots[current].classList.remove("is-active");
      dots[current].setAttribute("aria-selected", "false");
      if (advance) dots[current].classList.add("is-played");

      current = (next + slides.length) % slides.length;
      const slide = slides[current];
      slide.classList.add("is-active");

      // Update city plate with a tiny fade
      if (numEl && cityEl) {
        numEl.classList.add("is-changing");
        cityEl.classList.add("is-changing");
        setTimeout(() => {
          numEl.textContent = slide.dataset.num || String(current + 1).padStart(2, "0");
          cityEl.textContent = slide.dataset.city || "";
          numEl.classList.remove("is-changing");
          cityEl.classList.remove("is-changing");
        }, 200);
      }

      dots[current].classList.add("is-active");
      dots[current].classList.remove("is-played");
      dots[current].setAttribute("aria-selected", "true");

      // Restart the dot fill animation by toggling a class
      const fill = dots[current].querySelector(".dot__fill");
      if (fill) {
        fill.style.animation = "none";
        // force reflow
        // eslint-disable-next-line no-unused-expressions
        fill.offsetWidth;
        fill.style.animation = "";
      }
    }

    function next() {
      show(current + 1, { advance: true });
    }

    function start() {
      if (reduced || paused) return;
      stop();
      timer = setInterval(next, DURATION);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function setPaused(state) {
      paused = state;
      slideshow.classList.toggle("is-paused", state);
      if (state) stop();
      else start();
    }

    // Dots: click to jump
    dots.forEach((dot, i) => {
      dot.addEventListener("click", () => {
        show(i);
        // mark all prior as played, none after
        dots.forEach((d, di) => {
          d.classList.toggle("is-played", di < i);
        });
        start();
      });
    });

    // Pause on hover / focus-within
    const hero = document.querySelector(".hero");
    if (hero) {
      hero.addEventListener("mouseenter", () => setPaused(true));
      hero.addEventListener("mouseleave", () => setPaused(false));
      hero.addEventListener("focusin", () => setPaused(true));
      hero.addEventListener("focusout", (e) => {
        if (!hero.contains(e.relatedTarget)) setPaused(false);
      });
    }

    // Pause when scrolled past hero
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) start();
            else stop();
          });
        },
        { threshold: 0.1 }
      );
      io.observe(slideshow);
    }

    // Keyboard: arrows when slideshow controls are focused
    document.querySelector(".slideshow__dots")?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        show(current + 1);
        start();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        show(current - 1);
        start();
      }
    });

    // Preload non-first slides
    slides.slice(1).forEach((s) => {
      const img = s.querySelector("img");
      if (img && !img.complete) {
        const pre = new Image();
        pre.src = img.src;
      }
    });

    if (!reduced) start();
  }

  /* ------------------------------------------------------------------ */
  /* Scroll progress bar                                                 */
  /* ------------------------------------------------------------------ */
  const progress = document.querySelector(".progress > span");
  if (progress) {
    let raf = null;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      progress.style.width = pct + "%";
      raf = null;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (raf === null) raf = requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  }

  /* ------------------------------------------------------------------ */
  /* Year stamp                                                          */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ------------------------------------------------------------------ */
  /* Reveal-on-scroll for sections                                       */
  /* ------------------------------------------------------------------ */
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const targets = document.querySelectorAll(
      ".section, .service, .pillar, .week__day, .card"
    );
    targets.forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(18px)";
      el.style.transition = "opacity 700ms cubic-bezier(0.2, 0.7, 0.2, 1), transform 700ms cubic-bezier(0.2, 0.7, 0.2, 1)";
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            // Slight stagger for grouped items
            const delay = Math.min(i * 60, 240);
            setTimeout(() => {
              entry.target.style.opacity = "1";
              entry.target.style.transform = "translateY(0)";
            }, delay);
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    targets.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------ */
  /* Contact form: show success state after Netlify redirect             */
  /* ------------------------------------------------------------------ */
  const params = new URLSearchParams(window.location.search);
  if (params.get("sent") === "1") {
    const form = document.querySelector(".form");
    if (form) {
      const success = document.createElement("div");
      success.className = "form form--success";
      success.innerHTML = `
        <h3>Thanks — we got it.</h3>
        <p>A real person here in Batavia will read your note and respond within one business day.</p>
      `;
      form.replaceWith(success);
      // Clean the URL without reloading
      if (window.history && history.replaceState) {
        history.replaceState({}, "", window.location.pathname + "#contact");
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Smooth-scroll fallback for older Safari                             */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      // Native scroll-behavior handles this, but on iOS old Safari it doesn't:
      if (!("scrollBehavior" in document.documentElement.style)) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
})();
