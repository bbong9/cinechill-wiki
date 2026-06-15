(() => {
  const INTRO_SESSION_KEY = 'cinechill-wiki-intro-entered-at';
  const INTRO_SKIP_WINDOW_MS = 5 * 60 * 1000;

  const getSessionEnteredAt = () => {
    try {
      return Number(sessionStorage.getItem(INTRO_SESSION_KEY) || 0);
    } catch {
      return 0;
    }
  };

  const markIntroEntered = () => {
    try {
      sessionStorage.setItem(INTRO_SESSION_KEY, String(Date.now()));
    } catch {
      // Session storage can be unavailable in hardened browser modes.
    }
  };

  const shouldSkipIntro = () => {
    const enteredAt = getSessionEnteredAt();
    return enteredAt > 0 && Date.now() - enteredAt < INTRO_SKIP_WINDOW_MS;
  };

  class Particle {
    constructor() {
      this.pos = { x: 0, y: 0 };
      this.vel = { x: 0, y: 0 };
      this.acc = { x: 0, y: 0 };
      this.target = { x: 0, y: 0 };
      this.closeEnoughTarget = 100;
      this.maxSpeed = 1;
      this.maxForce = 0.1;
      this.particleSize = 10;
      this.isKilled = false;
      this.startColor = { r: 0, g: 0, b: 0 };
      this.targetColor = { r: 0, g: 0, b: 0 };
      this.colorWeight = 0;
      this.colorBlendRate = 0.01;
      this.fillStyle = 'rgb(0, 0, 0)';
      this.prevR = -1;
      this.prevG = -1;
      this.prevB = -1;
    }

    move() {
      const dx = this.target.x - this.pos.x;
      const dy = this.target.y - this.pos.y;
      const distSq = dx * dx + dy * dy;
      let targetVelX = 0;
      let targetVelY = 0;

      if (distSq > 0.0001) {
        const distance = Math.sqrt(distSq);
        const proximityMult = distance < this.closeEnoughTarget ? distance / this.closeEnoughTarget : 1;
        const speed = this.maxSpeed * proximityMult / distance;
        targetVelX = dx * speed;
        targetVelY = dy * speed;
      }

      let steerX = targetVelX - this.vel.x;
      let steerY = targetVelY - this.vel.y;
      const steerSq = steerX * steerX + steerY * steerY;
      if (steerSq > 0.0001) {
        const steerScale = this.maxForce / Math.sqrt(steerSq);
        steerX *= steerScale;
        steerY *= steerScale;
      }

      this.vel.x += this.acc.x + steerX;
      this.vel.y += this.acc.y + steerY;
      this.pos.x += this.vel.x;
      this.pos.y += this.vel.y;
      this.acc.x = 0;
      this.acc.y = 0;
    }

    draw(ctx) {
      if (this.colorWeight < 1) this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1);
      const weight = this.colorWeight;
      const inverseWeight = 1 - weight;
      const r = Math.round(this.startColor.r * inverseWeight + this.targetColor.r * weight);
      const g = Math.round(this.startColor.g * inverseWeight + this.targetColor.g * weight);
      const b = Math.round(this.startColor.b * inverseWeight + this.targetColor.b * weight);

      if (r !== this.prevR || g !== this.prevG || b !== this.prevB) {
        this.fillStyle = `rgb(${r}, ${g}, ${b})`;
        this.prevR = r;
        this.prevG = g;
        this.prevB = b;
      }

      ctx.fillStyle = this.fillStyle;
      ctx.fillRect(this.pos.x, this.pos.y, 2, 2);
    }

    kill(width, height, killColor = getThemeColors().killColor) {
      if (this.isKilled) return;
      setRandomPos(this.target, width / 2, height / 2, (width + height) / 2);
      const weight = this.colorWeight;
      const startColor = this.startColor;
      const targetColor = this.targetColor;
      startColor.r += (targetColor.r - startColor.r) * weight;
      startColor.g += (targetColor.g - startColor.g) * weight;
      startColor.b += (targetColor.b - startColor.b) * weight;
      this.targetColor = killColor;
      this.colorWeight = 0;
      this.isKilled = true;
    }
  }

  const introPalettes = {
    light: [
      { r: 14, g: 116, b: 144 },
      { r: 37, g: 99, b: 235 },
      { r: 109, g: 40, b: 217 },
      { r: 8, g: 145, b: 178 },
    ],
    dark: [
      { r: 120, g: 240, b: 255 },
      { r: 132, g: 98, b: 255 },
      { r: 195, g: 96, b: 255 },
      { r: 82, g: 168, b: 255 },
    ],
  };

  const getIntroTheme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  const getThemeColors = () => {
    const theme = getIntroTheme();
    return {
      theme,
      palette: introPalettes[theme],
      trail: theme === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(248, 251, 255, 0.16)',
      staticBackground: theme === 'dark' ? '#030305' : '#f8fbff',
      staticText: theme === 'dark' ? '#f7f8ff' : '#0f3b57',
      killColor: theme === 'dark' ? { r: 0, g: 0, b: 0 } : { r: 248, g: 251, b: 255 },
    };
  };

  const setRandomPos = (target, x, y, mag) => {
    const randomX = Math.random() * 1000;
    const randomY = Math.random() * 500;
    const directionX = randomX - x;
    const directionY = randomY - y;
    const magnitude = Math.sqrt(directionX * directionX + directionY * directionY);
    if (magnitude > 0) {
      const scale = mag / magnitude;
      target.x = x + directionX * scale;
      target.y = y + directionY * scale;
      return;
    }
    target.x = x;
    target.y = y;
  };

  const shuffle = (items) => {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  const getWords = (canvas) => (canvas.dataset.words || 'WELCOME TO|CINECHILL-WIKI|DESIGN BY|BBONG9')
    .split('|')
    .map((word) => word.trim().toUpperCase())
    .filter(Boolean);

  const fitFontSize = (ctx, word, width, height) => {
    let fontSize = Math.min(210, Math.max(54, width * 0.18), height * 0.32);
    const maxWidth = width * 0.86;
    const maxHeight = height * 0.38;

    while (fontSize > 36) {
      ctx.font = `900 ${fontSize}px Arial Black, Arial, Helvetica, sans-serif`;
      const metrics = ctx.measureText(word);
      if (metrics.width <= maxWidth && fontSize <= maxHeight) return fontSize;
      fontSize -= 3;
    }
    return fontSize;
  };

  const drawWordMask = (canvas, word) => {
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    const fontSize = fitFontSize(offscreenCtx, word, canvas.width, canvas.height);

    offscreenCtx.clearRect(0, 0, canvas.width, canvas.height);
    offscreenCtx.fillStyle = '#fff';
    offscreenCtx.font = `900 ${fontSize}px Arial Black, Arial, Helvetica, sans-serif`;
    offscreenCtx.textAlign = 'center';
    offscreenCtx.textBaseline = 'middle';
    offscreenCtx.fillText(word, canvas.width / 2, canvas.height / 2);
    return offscreenCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  };

  const startIntro = (section) => {
    const canvas = section.querySelector('[data-intro-particle]');
    const home = document.querySelector('.layout.is-home');
    if (!canvas || !home) return;

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    const words = getWords(canvas);
    const particles = [];
    const mouse = { x: 0, y: 0, isPressed: false, isRightClick: false };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let wordIndex = 0;
    let frameCount = 0;
    let animationId = 0;
    let resizeTimer = 0;
    let cachedThemeColors = getThemeColors();

    const sizeCanvas = () => {
      const rect = section.getBoundingClientRect();
      canvas.width = Math.max(320, Math.round(rect.width));
      canvas.height = Math.max(320, Math.round(rect.height));
    };

    const targetWord = (word) => {
      const pixels = drawWordMask(canvas, word);
      cachedThemeColors = getThemeColors();
      const baseColor = cachedThemeColors.palette[wordIndex % cachedThemeColors.palette.length];
      const targetColor = {
        r: Math.min(255, baseColor.r + Math.random() * 26),
        g: Math.min(255, baseColor.g + Math.random() * 18),
        b: Math.min(255, baseColor.b + Math.random() * 20),
      };
      const pixelSteps = canvas.width < 640 ? 5 : canvas.width > 1600 ? 7 : 6;
      const coords = [];

      for (let y = 0; y < canvas.height; y += pixelSteps) {
        const rowOffset = y * canvas.width * 4;
        for (let x = 0; x < canvas.width; x += pixelSteps) {
          if (pixels[rowOffset + x * 4 + 3] > 0) coords.push(x, y);
        }
      }

      for (let i = coords.length - 2; i > 0; i -= 2) {
        const j = Math.floor(Math.random() * ((i / 2) + 1)) * 2;
        const x = coords[i];
        const y = coords[i + 1];
        coords[i] = coords[j];
        coords[i + 1] = coords[j + 1];
        coords[j] = x;
        coords[j + 1] = y;
      }

      let particleIndex = 0;
      for (let coordIndex = 0; coordIndex < coords.length; coordIndex += 2) {
        let particle;
        if (particleIndex < particles.length) {
          particle = particles[particleIndex];
          particle.isKilled = false;
          particleIndex += 1;
        } else {
          particle = new Particle();
          setRandomPos(particle.pos, canvas.width / 2, canvas.height / 2, (canvas.width + canvas.height) / 2);
          particle.maxSpeed = Math.random() * 6 + 4;
          particle.maxForce = particle.maxSpeed * 0.05;
          particle.particleSize = Math.random() * 6 + 6;
          particle.colorBlendRate = Math.random() * 0.0275 + 0.0025;
          particles.push(particle);
        }

        const weight = particle.colorWeight;
        const startColor = particle.startColor;
        const currentTargetColor = particle.targetColor;
        startColor.r += (currentTargetColor.r - startColor.r) * weight;
        startColor.g += (currentTargetColor.g - startColor.g) * weight;
        startColor.b += (currentTargetColor.b - startColor.b) * weight;
        particle.targetColor = targetColor;
        particle.colorWeight = 0;
        particle.target.x = coords[coordIndex];
        particle.target.y = coords[coordIndex + 1];
      }

      const killColor = cachedThemeColors.killColor;
      for (let i = particleIndex; i < particles.length; i += 1) particles[i].kill(canvas.width, canvas.height, killColor);
      section.dataset.currentWord = word;
    };

    const drawReducedMotion = () => {
      const themeColors = getThemeColors();
      ctx.fillStyle = themeColors.staticBackground;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = themeColors.staticText;
      const word = words[wordIndex] || '';
      const fontSize = fitFontSize(ctx, word, canvas.width, canvas.height);
      ctx.font = `900 ${fontSize}px Arial Black, Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, canvas.width / 2, canvas.height / 2);
      section.dataset.currentWord = word;
    };

    const animate = () => {
      ctx.fillStyle = cachedThemeColors.trail;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.move();
        particle.draw(ctx);
        if (
          particle.isKilled &&
          (particle.pos.x < 0 || particle.pos.x > canvas.width || particle.pos.y < 0 || particle.pos.y > canvas.height)
        ) {
          particles.splice(i, 1);
        }
      }

      if (mouse.isPressed && mouse.isRightClick) {
        const killColor = cachedThemeColors.killColor;
        particles.forEach((particle) => {
          const dx = particle.pos.x - mouse.x;
          const dy = particle.pos.y - mouse.y;
          if (dx * dx + dy * dy < 2500) {
            particle.kill(canvas.width, canvas.height, killColor);
          }
        });
      }

      frameCount += 1;
      if (frameCount % 360 === 0) {
        wordIndex = (wordIndex + 1) % words.length;
        targetWord(words[wordIndex]);
      }
      animationId = window.requestAnimationFrame(animate);
    };

    const syncMouse = (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
      mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
    };

    const startHomeReveal = () => {
      window.requestAnimationFrame(() => {
        document.documentElement.classList.remove('home-reveal-pending');
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('cinechill:home-reveal'));
        }, 520);
      });
    };

    const teardownIntro = () => {
      markIntroEntered();
      document.documentElement.classList.remove('intro-locked');
      document.documentElement.classList.remove('intro-preparing-home');
      if (animationId) {
        window.cancelAnimationFrame(animationId);
        animationId = 0;
      }
      section.remove();
      window.scrollTo({ top: 0, behavior: 'auto' });
      startHomeReveal();
    };

    const enterHome = () => {
      if (section.dataset.entered === 'true') return;
      section.dataset.entered = 'true';
      section.classList.add('is-leaving');
      document.documentElement.classList.add('intro-preparing-home');
      if (animationId) {
        window.cancelAnimationFrame(animationId);
        animationId = 0;
      }
      if (reducedMotion) {
        teardownIntro();
        return;
      }
      window.setTimeout(teardownIntro, 360);
    };

    const handleIntroWheel = (event) => {
      if (!document.body.contains(section) || section.dataset.entered === 'true') return;
      if (event.deltaY <= 0) return;
      event.preventDefault();
      event.stopPropagation();
      window.scrollTo({ top: 0, behavior: 'auto' });
      enterHome();
    };

    section.addEventListener('click', (event) => {
      if (event.button === 0) enterHome();
    });
    section.addEventListener('wheel', handleIntroWheel, { passive: false, capture: true });
    window.addEventListener('wheel', handleIntroWheel, { passive: false, capture: true });

    let touchStartY = 0;
    const handleIntroTouchStart = (event) => {
      touchStartY = event.touches[0]?.clientY || 0;
    };
    const handleIntroTouchMove = (event) => {
      if (!document.body.contains(section) || section.dataset.entered === 'true') return;
      const touchY = event.touches[0]?.clientY || touchStartY;
      if (touchStartY - touchY <= 1) return;
      event.preventDefault();
      event.stopPropagation();
      window.scrollTo({ top: 0, behavior: 'auto' });
      enterHome();
    };
    section.addEventListener('touchstart', handleIntroTouchStart, { passive: true, capture: true });
    section.addEventListener('touchmove', handleIntroTouchMove, { passive: false, capture: true });
    window.addEventListener('touchmove', handleIntroTouchMove, { passive: false, capture: true });
    section.addEventListener('touchend', () => {
      touchStartY = 0;
    }, { passive: true });

    canvas.addEventListener('mousedown', (event) => {
      mouse.isPressed = true;
      mouse.isRightClick = event.button === 2;
      syncMouse(event);
    });
    canvas.addEventListener('mouseup', () => {
      mouse.isPressed = false;
      mouse.isRightClick = false;
    });
    canvas.addEventListener('mouseleave', () => {
      mouse.isPressed = false;
      mouse.isRightClick = false;
    });
    canvas.addEventListener('mousemove', syncMouse);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        sizeCanvas();
        if (reducedMotion) drawReducedMotion();
        else targetWord(words[wordIndex]);
      }, 120);
    });

    sizeCanvas();
    if (reducedMotion) {
      drawReducedMotion();
    } else {
      targetWord(words[wordIndex]);
      animate();
    }

    window.addEventListener('pagehide', () => {
      if (animationId) window.cancelAnimationFrame(animationId);
    }, { once: true });
  };

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-intro-start]').forEach((section) => {
      if (shouldSkipIntro()) {
        document.documentElement.classList.remove('intro-locked');
        section.remove();
        window.scrollTo({ top: 0, behavior: 'auto' });
        window.requestAnimationFrame(() => {
          document.documentElement.classList.remove('home-reveal-pending');
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('cinechill:home-reveal'));
          }, 520);
        });
        return;
      }
      startIntro(section);
    });
  });
})();
