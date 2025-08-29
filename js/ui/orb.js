// /js/ui/orb.js
// Orbe animado de Grooky (ondas amarillo + verde-azul) en <canvas> circular.
// - Respeta 'prefers-reduced-motion'.
// - Pausa/reanuda con visibilitychange.
// - Se adapta a DPR y resize del canvas.
// - Limpieza segura via destroyOrb().
//
// API:
//   initOrb(canvas: HTMLCanvasElement, opts?)
//   destroyOrb(canvas: HTMLCanvasElement)

const _state = new WeakMap();

/**
 * Inicializa el orbe en un canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   speed?: number,       // velocidad base de animación
 *   amp1?: number,        // amplitud onda 1 (amarillo)
 *   amp2?: number,        // amplitud onda 2 (teal)
 *   freq1?: number,       // frecuencia onda 1
 *   freq2?: number,       // frecuencia onda 2
 *   strokeGlow?: number,  // opacidad del borde exterior
 * }} [opts]
 */
export function initOrb(canvas, opts = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) return;

  // Evita doble init
  if (_state.has(canvas)) {
    destroyOrb(canvas);
  }

  // Colores desde CSS variables (con fallback)
  const css = getComputedStyle(document.documentElement);
  const YELLOW = css.getPropertyValue('--accent-yellow').trim() || '#FFD54F';
  const TEAL   = css.getPropertyValue('--accent-teal').trim()   || '#00D8A7';

  const state = {
    ctx: canvas.getContext('2d'),
    dpr: Math.max(1, window.devicePixelRatio || 1),
    w: 0,
    h: 0,
    t: 0,
    rafId: 0,
    ro: null, // ResizeObserver
    mm: null, // matchMedia listener
    opts: {
      speed:     isFinite(opts.speed) ? Number(opts.speed) : 0.03,
      amp1:      isFinite(opts.amp1) ? Number(opts.amp1) : 1.6,
      amp2:      isFinite(opts.amp2) ? Number(opts.amp2) : 1.3,
      freq1:     isFinite(opts.freq1) ? Number(opts.freq1) : 0.020,
      freq2:     isFinite(opts.freq2) ? Number(opts.freq2) : 0.024,
      strokeGlow:isFinite(opts.strokeGlow) ? Number(opts.strokeGlow) : 0.35,
      color1:    YELLOW,
      color2:    TEAL
    },
    paused: false
  };

  if (!state.ctx) return;

  _state.set(canvas, state);

  // Inicializa tamaño en función del CSS + DPR
  const setupSize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    state.dpr = dpr;
    state.w = Math.max(1, Math.round(rect.width));
    state.h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.max(1, Math.floor(state.w * dpr));
    canvas.height = Math.max(1, Math.floor(state.h * dpr));
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // escala el contexto
  };

  setupSize();

  // Observa cambios de tamaño del canvas
  if ('ResizeObserver' in window) {
    state.ro = new ResizeObserver(() => setupSize());
    state.ro.observe(canvas);
  } else {
    // Fallback simple
    window.addEventListener('resize', setupSize);
  }

  // Respeta preferencias de movimiento reducido
  const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const applyReducedMotion = () => {
    state.paused = !!(mql && mql.matches);
    if (!state.paused) loop(); // relanza si despausado
  };
  if (mql) {
    state.mm = applyReducedMotion;
    mql.addEventListener?.('change', applyReducedMotion);
    applyReducedMotion();
  }

  // Pausa al perder visibilidad
  const onVis = () => {
    if (document.hidden) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    } else if (!state.paused) {
      loop();
    }
  };
  document.addEventListener('visibilitychange', onVis);

  // Guarda para limpieza
  state._onVis = onVis;

  // Bucle principal
  function loop() {
    if (state.paused || document.hidden) return;
    draw(canvas, state);
    state.t += state.opts.speed;
    state.rafId = requestAnimationFrame(loop);
  }

  // Primer frame
  loop();
}

/**
 * Detiene y limpia el orbe del canvas.
 * @param {HTMLCanvasElement} canvas
 */
export function destroyOrb(canvas) {
  const state = _state.get(canvas);
  if (!state) return;
  cancelAnimationFrame(state.rafId);
  state.rafId = 0;
  if (state.ro) {
    try { state.ro.disconnect(); } catch {}
  } else {
    window.removeEventListener('resize', () => {});
  }
  const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (mql && state.mm) {
    mql.removeEventListener?.('change', state.mm);
  }
  if (state._onVis) {
    document.removeEventListener('visibilitychange', state._onVis);
  }
  _state.delete(canvas);
}

/* ==================== Draw ==================== */

function draw(canvas, s) {
  const { ctx, w, h, t, opts } = s;
  if (!ctx || !w || !h) return;

  ctx.clearRect(0, 0, w, h);

  // Clip circular
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  ctx.clip();

  // Fondo radial suave (usa los acentos con baja opacidad)
  const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
  bg.addColorStop(0, hexWithAlpha(opts.color1, 0.15));
  bg.addColorStop(1, hexWithAlpha(opts.color2, 0.10));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Ondas
  wave(ctx, w, h, opts.color1, opts.amp1, opts.freq1, t * 1.10);
  wave(ctx, w, h, opts.color2, opts.amp2, opts.freq2, t * 1.35 + 2.0);

  ctx.restore();

  // Borde exterior con glow sutil
  ctx.strokeStyle = hexWithAlpha(opts.color1, opts.strokeGlow);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 0.5, 0, Math.PI * 2);
  ctx.stroke();
}

function wave(ctx, W, H, color, amp, freq, phase) {
  ctx.beginPath();
  for (let x = 0; x <= W; x++) {
    const y =
      H / 2 +
      Math.sin(x * freq + phase) * (H / 10) * amp +
      Math.sin(x * freq * 0.5 + phase * 0.7) * (H / 20);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/* ==================== Helpers ==================== */

/**
 * Convierte un color hex (#RRGGBB) a rgba con alpha.
 * Si el color no es hex, retorna con alpha vía canvas globalAlpha (fallback).
 */
function hexWithAlpha(hex, alpha) {
  // Soporta #RGB o #RRGGBB
  const m = String(hex).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) {
    // No es hex: devolver color tal cual y ojalá sea CSS válido con alpha (fallback)
    // Pero aquí devolvemos 'rgba(0,0,0,alpha)' para no romper
    try {
      // Podríamos parsear otros formatos, pero mantengamos simple
      return `rgba(0,0,0,${alpha})`;
    } catch {
      return hex;
    }
  }
  let c = m[1];
  if (c.length === 3) {
    c = c.split('').map((ch) => ch + ch).join('');
  }
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
