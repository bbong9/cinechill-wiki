(() => {
  const boot = () => {
    const images = Array.from(document.querySelectorAll('.screenshot-pair img, .carousel-theme-screenshot'));
    if (!images.length || document.querySelector('[data-cinechill-lightbox]')) return;

    const overlay = document.createElement('div');
    overlay.className = 'cinechill-lightbox';
    overlay.dataset.cinechillLightbox = 'true';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '截图放大查看');
    overlay.innerHTML = `
      <button class="cinechill-lightbox-close" type="button" aria-label="关闭截图">×</button>
      <img class="cinechill-lightbox-image" alt="">
    `;
    document.body.appendChild(overlay);

    const lightboxImage = overlay.querySelector('.cinechill-lightbox-image');
    const closeButton = overlay.querySelector('.cinechill-lightbox-close');
    let previousFocus = null;

    const close = () => {
      if (overlay.hidden) return;
      overlay.hidden = true;
      document.documentElement.classList.remove('cinechill-lightbox-open');
      lightboxImage.removeAttribute('src');
      lightboxImage.alt = '';
      previousFocus?.focus?.();
      previousFocus = null;
    };

    const open = (image) => {
      const src = image.currentSrc || image.getAttribute('src') || image.dataset.lazySrc;
      if (!src) return;
      if (image.dataset.lazySrc && !image.getAttribute('src')) image.setAttribute('src', image.dataset.lazySrc);
      previousFocus = document.activeElement;
      lightboxImage.src = src;
      lightboxImage.alt = image.alt || '截图';
      overlay.hidden = false;
      document.documentElement.classList.add('cinechill-lightbox-open');
      closeButton.focus();
    };

    images.forEach((image) => {
      image.classList.add('is-zoomable');
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', '点击放大查看截图');
      image.addEventListener('click', () => open(image));
      image.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open(image);
        }
      });
    });

    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
