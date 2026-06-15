(() => {
  const storageKey = 'cinechill-wiki-top-nav-indicator';
  const navSelector = '.top-menu';
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopQuery = window.matchMedia('(min-width: 960px)');
  const getLampWidth = (width) => Math.min(Math.max(width * 0.68, 52), 86, Math.max(42, width - 18));

  const normalizeHref = (href) => {
    try {
      const url = new URL(href, window.location.href);
      return url.pathname.replace(/\/index\.html$/, '/');
    } catch {
      return String(href || '');
    }
  };

  const readSaved = () => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    } catch {
      return null;
    }
  };

  const saveState = (href, box) => {
    if (!box) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ href, ...box, ts: Date.now() }));
    } catch {
      // Navigation still works when sessionStorage is blocked.
    }
  };

  const measure = (menu, link) => {
    if (!menu || !link) return null;
    const menuRect = menu.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (!linkRect.width || !linkRect.height) return null;
    const left = linkRect.left - menuRect.left;
    const width = linkRect.width;
    const lampWidth = getLampWidth(width);
    const lampLeft = left + (width - lampWidth) / 2;
    return { left, width, lampLeft, lampWidth };
  };

  const isUsableBox = (box) => box && Number.isFinite(box.left) && Number.isFinite(box.width) && box.width > 0 && Number.isFinite(box.lampWidth) && box.lampWidth > 0;

  const applyVars = (menu, box) => {
    if (!menu || !isUsableBox(box)) return;
    menu.style.setProperty('--nav-indicator-left', `${box.left.toFixed(2)}px`);
    menu.style.setProperty('--nav-indicator-width', `${box.width.toFixed(2)}px`);
    menu.style.setProperty('--nav-lamp-left', `${box.lampLeft.toFixed(2)}px`);
    menu.style.setProperty('--nav-lamp-width', `${box.lampWidth.toFixed(2)}px`);
    menu.style.setProperty('--nav-indicator-opacity', '1');
    menu.classList.add('nav-indicator-ready');
  };

  const findActive = (menu) => {
    const links = Array.from(menu.querySelectorAll('a[href]'));
    const current = normalizeHref(window.location.href);
    return menu.querySelector('a.active') || links.find((link) => normalizeHref(link.href) === current) || links[0];
  };

  const createSpringIndicator = (menu, initialBox) => {
    const state = {
      x: initialBox.left,
      w: initialBox.width,
      lamp: initialBox.lampLeft,
      lampWidth: initialBox.lampWidth,
      vx: 0,
      vw: 0,
      vlamp: 0,
      vlampWidth: 0,
      tx: initialBox.left,
      tw: initialBox.width,
      tlamp: initialBox.lampLeft,
      tlampWidth: initialBox.lampWidth,
      raf: 0,
      running: false,
    };

    const snapshot = () => ({ left: state.x, width: state.w, lampLeft: state.lamp, lampWidth: state.lampWidth });
    const targetSnapshot = () => ({ left: state.tx, width: state.tw, lampLeft: state.tlamp, lampWidth: state.tlampWidth });

    const snap = (box) => {
      if (!isUsableBox(box)) return;
      window.cancelAnimationFrame(state.raf);
      state.running = false;
      state.x = state.tx = box.left;
      state.w = state.tw = box.width;
      state.lamp = state.tlamp = box.lampLeft;
      state.lampWidth = state.tlampWidth = box.lampWidth;
      state.vx = state.vw = state.vlamp = state.vlampWidth = 0;
      applyVars(menu, box);
    };

    const settle = () => {
      state.x = state.tx;
      state.w = state.tw;
      state.lamp = state.tlamp;
      state.lampWidth = state.tlampWidth;
      state.vx = state.vw = state.vlamp = state.vlampWidth = 0;
      applyVars(menu, targetSnapshot());
    };

    const tick = () => {
      if (!desktopQuery.matches || reduceMotionQuery.matches) {
        settle();
        state.running = false;
        return;
      }

      // Borrowed from the reference canvas idea: velocity + spring pull + friction,
      // adapted to a tiny nav indicator so it stays responsive and cheap to render.
      const spring = 0.15;
      const friction = 0.56;

      state.vx = (state.vx + (state.tx - state.x) * spring) * friction;
      state.vw = (state.vw + (state.tw - state.w) * spring) * friction;
      state.vlamp = (state.vlamp + (state.tlamp - state.lamp) * spring) * friction;
      state.vlampWidth = (state.vlampWidth + (state.tlampWidth - state.lampWidth) * spring) * friction;
      state.x += state.vx;
      state.w += state.vw;
      state.lamp += state.vlamp;
      state.lampWidth += state.vlampWidth;

      applyVars(menu, snapshot());

      const resting =
        Math.abs(state.tx - state.x) < 0.08 &&
        Math.abs(state.tw - state.w) < 0.08 &&
        Math.abs(state.tlamp - state.lamp) < 0.08 &&
        Math.abs(state.tlampWidth - state.lampWidth) < 0.08 &&
        Math.abs(state.vx) < 0.08 &&
        Math.abs(state.vw) < 0.08 &&
        Math.abs(state.vlamp) < 0.08 &&
        Math.abs(state.vlampWidth) < 0.08;

      if (resting) {
        settle();
        state.running = false;
        return;
      }

      state.raf = window.requestAnimationFrame(tick);
    };

    const moveTo = (box, immediate = false) => {
      if (!isUsableBox(box)) return;
      const sameTarget =
        Math.abs(state.tx - box.left) < 0.05 &&
        Math.abs(state.tw - box.width) < 0.05 &&
        Math.abs(state.tlamp - box.lampLeft) < 0.05 &&
        Math.abs(state.tlampWidth - box.lampWidth) < 0.05;
      if (sameTarget && !state.running && !immediate) return;
      if (immediate || reduceMotionQuery.matches) {
        snap(box);
        return;
      }
      state.tx = box.left;
      state.tw = box.width;
      state.tlamp = box.lampLeft;
      state.tlampWidth = box.lampWidth;
      if (!state.running) {
        state.running = true;
        state.raf = window.requestAnimationFrame(tick);
      }
    };

    snap(initialBox);
    return { moveTo, snap };
  };

  const setupTopMenu = () => {
    const menu = document.querySelector(navSelector);
    if (!menu || !desktopQuery.matches || menu.dataset.navFollowReady === 'true') return;

    const links = Array.from(menu.querySelectorAll('a[href]'));
    if (!links.length) return;

    menu.dataset.navFollowReady = 'true';
    menu.classList.add('nav-spring-ready');

    let active = findActive(menu);
    let currentBox = measure(menu, active) || measure(menu, links[0]);
    if (!isUsableBox(currentBox)) return;

    const indicator = createSpringIndicator(menu, currentBox);
    const currentHref = normalizeHref(active?.href || window.location.href);
    const saved = readSaved();
    const savedFresh = saved && Number(saved.ts) && Date.now() - Number(saved.ts) < 2500 && isUsableBox(saved);

    if (savedFresh && saved.href !== currentHref && !reduceMotionQuery.matches) {
      indicator.snap(saved);
      window.requestAnimationFrame(() => indicator.moveTo(currentBox));
    } else {
      indicator.snap(currentBox);
    }

    saveState(currentHref, currentBox);

    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (link.target && link.target !== '_self') return;

        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin) return;

        const targetHref = normalizeHref(link.href);
        const targetBox = measure(menu, link);
        if (!isUsableBox(targetBox)) return;

        event.preventDefault();
        active = link;
        links.forEach((item) => item.classList.toggle('active', item === link));
        indicator.moveTo(targetBox);
        saveState(targetHref, targetBox);

        if (targetHref === normalizeHref(window.location.href)) return;
        window.setTimeout(() => {
          window.location.href = link.href;
        }, reduceMotionQuery.matches ? 0 : 220);
      });
    });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!desktopQuery.matches) return;
        const nextActive = findActive(menu);
        const nextBox = measure(menu, nextActive);
        indicator.snap(nextBox);
        saveState(normalizeHref(nextActive?.href || window.location.href), nextBox);
      }, 80);
    }, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTopMenu, { once: true });
  } else {
    setupTopMenu();
  }
})();
