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
    overlay.setAttribute('aria-label', '截图悬浮放大查看');
    overlay.innerHTML = `
      <section class="cinechill-lightbox-panel">
        <header class="cinechill-lightbox-toolbar">
          <span class="cinechill-lightbox-title">截图预览</span>
          <div class="cinechill-lightbox-actions">
            <button type="button" class="cinechill-lightbox-control" data-lightbox-zoom-out aria-label="缩小截图">−</button>
            <span class="cinechill-lightbox-zoom" data-lightbox-zoom aria-live="polite">适应窗口</span>
            <button type="button" class="cinechill-lightbox-control" data-lightbox-zoom-in aria-label="放大截图">＋</button>
            <button type="button" class="cinechill-lightbox-reset" data-lightbox-reset>适应窗口</button>
            <button class="cinechill-lightbox-close" type="button" aria-label="关闭截图">×</button>
          </div>
        </header>
        <div class="cinechill-lightbox-viewport" data-lightbox-viewport tabindex="0" aria-label="截图滚动查看区域">
          <div class="cinechill-lightbox-stage" data-lightbox-stage>
            <img class="cinechill-lightbox-image" alt="">
          </div>
        </div>
      </section>
    `;
    document.body.appendChild(overlay);

    const viewport = overlay.querySelector('[data-lightbox-viewport]');
    const stage = overlay.querySelector('[data-lightbox-stage]');
    const lightboxImage = overlay.querySelector('.cinechill-lightbox-image');
    const closeButton = overlay.querySelector('.cinechill-lightbox-close');
    const zoomLabel = overlay.querySelector('[data-lightbox-zoom]');
    const zoomIn = overlay.querySelector('[data-lightbox-zoom-in]');
    const zoomOut = overlay.querySelector('[data-lightbox-zoom-out]');
    const resetButton = overlay.querySelector('[data-lightbox-reset]');
    let previousFocus = null;
    let fitScale = 1;
    let scale = 1;
    let dragState = null;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const calculateFitScale = () => {
      if (!lightboxImage.naturalWidth || !lightboxImage.naturalHeight) return 1;
      const availableWidth = Math.max(viewport.clientWidth - 56, 240);
      const availableHeight = Math.max(viewport.clientHeight - 56, 180);
      return Math.min(1, availableWidth / lightboxImage.naturalWidth, availableHeight / lightboxImage.naturalHeight);
    };

    const centerViewport = () => {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
    };

    const render = (center = false) => {
      if (!lightboxImage.naturalWidth || !lightboxImage.naturalHeight) return;
      const width = Math.round(lightboxImage.naturalWidth * scale);
      const height = Math.round(lightboxImage.naturalHeight * scale);
      lightboxImage.style.width = `${width}px`;
      lightboxImage.style.height = `${height}px`;
      stage.style.width = `${Math.max(width + 56, viewport.clientWidth)}px`;
      stage.style.height = `${Math.max(height + 56, viewport.clientHeight)}px`;
      zoomLabel.textContent = scale === fitScale ? '适应窗口' : `${Math.round(scale * 100)}%`;
      if (center) centerViewport();
    };

    const setScale = (nextScale, center = false) => {
      scale = clamp(nextScale, Math.max(fitScale, 0.2), 3);
      render(center);
    };

    const resetView = () => {
      fitScale = calculateFitScale();
      setScale(fitScale, true);
    };

    const close = () => {
      if (overlay.hidden) return;
      overlay.hidden = true;
      document.documentElement.classList.remove('cinechill-lightbox-open');
      lightboxImage.removeAttribute('src');
      lightboxImage.removeAttribute('style');
      stage.removeAttribute('style');
      lightboxImage.alt = '';
      previousFocus?.focus?.();
      previousFocus = null;
      dragState = null;
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
      if (lightboxImage.complete) {
        fitScale = calculateFitScale();
        // Start slightly larger than the fit-to-window view so the screenshot is immediately readable.
        setScale(Math.max(fitScale, 1.15), true);
      }
      closeButton.focus();
    };

    lightboxImage.addEventListener('load', () => {
      fitScale = calculateFitScale();
      setScale(Math.max(fitScale, 1.15), true);
    });

    images.forEach((image) => {
      image.classList.add('is-zoomable');
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', '点击悬浮放大查看截图');
      image.addEventListener('click', () => open(image));
      image.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open(image);
        }
      });
    });

    closeButton.addEventListener('click', close);
    zoomIn.addEventListener('click', () => setScale(scale + 0.15));
    zoomOut.addEventListener('click', () => setScale(scale - 0.15));
    resetButton.addEventListener('click', resetView);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -0.1 : 0.1;
      setScale(scale + direction);
    }, { passive: false });
    viewport.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      dragState = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture?.(event.pointerId);
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!dragState) return;
      viewport.scrollLeft = dragState.left - (event.clientX - dragState.x);
      viewport.scrollTop = dragState.top - (event.clientY - dragState.y);
    });
    const stopDragging = () => {
      dragState = null;
      viewport.classList.remove('is-dragging');
    };
    viewport.addEventListener('pointerup', stopDragging);
    viewport.addEventListener('pointercancel', stopDragging);
    viewport.addEventListener('pointerleave', stopDragging);
    window.addEventListener('resize', () => {
      if (!overlay.hidden) {
        fitScale = calculateFitScale();
        if (scale <= fitScale + 0.01) setScale(fitScale, true);
        else render(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
      if (overlay.hidden) return;
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setScale(scale + 0.15);
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setScale(scale - 0.15);
      }
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
