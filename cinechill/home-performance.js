(() => {
  const runWhenIdle = (callback, timeout = 900) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(callback, { timeout });
      return;
    }
    window.setTimeout(callback, Math.min(timeout, 240));
  };

  const warmHomeImages = () => {
    // Browsers already decode visible eager posters while painting the hero.
    // Manually calling decode() on 24 images right after intro exit competes with
    // the title/poster entrance animation on the main thread, so only pre-warm a
    // tiny tail set after the first reveal has settled.
    const posters = Array.from(document.querySelectorAll('.is-home .poster-item img[loading="lazy"]'));
    runWhenIdle(() => {
      posters.slice(0, 8).forEach((image) => {
        if (typeof image.decode === 'function' && image.complete) image.decode().catch(() => {});
      });
    }, 1800);
  };

  const deferDesktopScreenshots = () => {
    const carousel = document.querySelector('.is-home .desktop-carousel');
    if (!carousel) return;

    const images = Array.from(carousel.querySelectorAll('img'));
    images.forEach((image) => {
      if (image.dataset.lazySrc) return;
      const src = image.getAttribute('src');
      if (!src) return;
      image.dataset.lazySrc = src;
      image.removeAttribute('src');
    });

    const hydrate = () => {
      images.forEach((image) => {
        if (!image.getAttribute('src') && image.dataset.lazySrc) {
          image.setAttribute('src', image.dataset.lazySrc);
        }
      });
    };

    if (!('IntersectionObserver' in window)) {
      hydrate();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        hydrate();
        observer.disconnect();
      }
    }, {
      root: null,
      rootMargin: '900px 0px',
      threshold: 0.01,
    });

    observer.observe(carousel);
  };

  const setupDesktopCarousel = () => {
    const carousel = document.querySelector('.is-home .desktop-carousel');
    if (!carousel) return;

    if (!('IntersectionObserver' in window)) {
      carousel.classList.add('is-animated');
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        carousel.classList.toggle('is-animated', entry.isIntersecting);
      });
    }, {
      root: null,
      rootMargin: '220px 0px',
      threshold: 0.01,
    });

    observer.observe(carousel);
  };

  const setup = () => {
    deferDesktopScreenshots();
    setupDesktopCarousel();
    warmHomeImages();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
