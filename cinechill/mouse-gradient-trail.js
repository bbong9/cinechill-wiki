(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const desktop = window.matchMedia('(min-width: 768px)');

  if (document.querySelector('.layout.is-home')) return;
  if (reduceMotion.matches || !finePointer.matches || !desktop.matches) return;

  const config = {
    trails: 24,
    size: 28,
    friction: 0.54,
    dampening: 0.026,
    tension: 0.988,
    lineWidth: 2.4,
    alpha: 0.07,
    idleMs: 1350,
    maxDpr: 1.6,
  };

  let canvas;
  let ctx;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lines = [];
  let running = false;
  let initialized = false;
  let raf = 0;
  let lastMoveAt = 0;
  const pos = { x: 0, y: 0 };

  class TrailNode {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
    }
  }

  class TrailLine {
    constructor(index) {
      this.spring = 0.43 + (index / config.trails) * 0.028 + (Math.random() - 0.5) * 0.035;
      this.friction = config.friction + (Math.random() - 0.5) * 0.012;
      this.nodes = Array.from({ length: config.size }, () => new TrailNode(pos.x, pos.y));
    }

    update() {
      let spring = this.spring;
      let node = this.nodes[0];
      node.vx += (pos.x - node.x) * spring;
      node.vy += (pos.y - node.y) * spring;

      for (let index = 0; index < this.nodes.length; index += 1) {
        node = this.nodes[index];
        if (index > 0) {
          const previous = this.nodes[index - 1];
          node.vx += (previous.x - node.x) * spring;
          node.vy += (previous.y - node.y) * spring;
          node.vx += previous.vx * config.dampening;
          node.vy += previous.vy * config.dampening;
        }
        node.vx *= this.friction;
        node.vy *= this.friction;
        node.x += node.vx;
        node.y += node.vy;
        spring *= config.tension;
      }
    }

    draw(index, hue) {
      const first = this.nodes[0];
      let x = first.x;
      let y = first.y;

      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let nodeIndex = 1; nodeIndex < this.nodes.length - 2; nodeIndex += 1) {
        const current = this.nodes[nodeIndex];
        const next = this.nodes[nodeIndex + 1];
        x = (current.x + next.x) * 0.5;
        y = (current.y + next.y) * 0.5;
        ctx.quadraticCurveTo(current.x, current.y, x, y);
      }

      const penultimate = this.nodes[this.nodes.length - 2];
      const last = this.nodes[this.nodes.length - 1];
      ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
      ctx.strokeStyle = `hsla(${(hue + index * 1.9) % 360}, 100%, 56%, ${config.alpha})`;
      ctx.lineWidth = config.lineWidth + (index / config.trails) * 0.45;
      ctx.stroke();
    }
  }

  const introLocked = () => document.documentElement.classList.contains('intro-locked');

  const ensureCanvas = () => {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'mouse-gradient-trail-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d', { alpha: true });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    resize();
  };

  const resize = () => {
    if (!canvas || !ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, config.maxDpr);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const resetLines = () => {
    lines = Array.from({ length: config.trails }, (_, index) => new TrailLine(index));
    initialized = true;
  };

  const clear = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
  };

  const stop = () => {
    running = false;
    window.cancelAnimationFrame(raf);
    clear();
  };

  const render = (time) => {
    if (!running || document.hidden || introLocked()) {
      stop();
      return;
    }

    clear();
    ctx.globalCompositeOperation = 'lighter';

    const baseHue = 350 + Math.sin(time * 0.0012) * 28;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      line.update();
      line.draw(index, baseHue);
    }

    ctx.globalCompositeOperation = 'source-over';

    if (time - lastMoveAt > config.idleMs) {
      stop();
      return;
    }

    raf = window.requestAnimationFrame(render);
  };

  const start = () => {
    if (running || document.hidden || introLocked()) return;
    running = true;
    raf = window.requestAnimationFrame(render);
  };

  const handlePointerMove = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    if (introLocked() || reduceMotion.matches || !finePointer.matches || !desktop.matches) return;

    ensureCanvas();
    pos.x = event.clientX;
    pos.y = event.clientY;
    lastMoveAt = performance.now();

    if (!initialized) resetLines();
    start();
  };

  const handleResize = () => {
    if (!canvas) return;
    resize();
    if (initialized) resetLines();
  };

  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('resize', handleResize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });

  reduceMotion.addEventListener?.('change', () => {
    if (reduceMotion.matches) stop();
  });
})();
