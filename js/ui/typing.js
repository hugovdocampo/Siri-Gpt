// /js/ui/typing.js
// Typing plano (no HTML) con control de velocidad y chunk,
// soporte de grafemas (emoji) y cancelación opcional por AbortController.

/**
 * Divide un string en "grafemas" visuales.
 * - Usa Intl.Segmenter si está disponible (mejor para emoji + diacríticos).
 * - Fallback: Array.from (code points), razonable para la mayoría de casos.
 * @param {string} s
 * @returns {string[]}
 */
function splitGraphemes(s) {
  try {
    // Elige un locale cualquiera; 'es' va bien. Granularity 'grapheme'.
    if ('Segmenter' in Intl) {
      const seg = new Intl.Segmenter('es', { granularity: 'grapheme' });
      return Array.from(seg.segment(s), segm => segm.segment);
    }
  } catch {
    /* noop */
  }
  // Fallback a code points
  return Array.from(s || '');
}

/**
 * Espera 'ms' milisegundos pudiendo cancelar con AbortSignal.
 * @param {number} ms
 * @param {AbortSignal=} signal
 * @returns {Promise<void>}
 */
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      resolve();
    }, Math.max(0, ms));

    const onAbort = () => {
      cleanup();
      reject(new Error('typing_aborted'));
    };

    function cleanup() {
      clearTimeout(t);
      if (signal) signal.removeEventListener('abort', onAbort);
    }

    if (signal) {
      if (signal.aborted) {
        cleanup();
        return reject(new Error('typing_aborted'));
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Escribe texto "a máquina" dentro de un elemento,
 * añadiendo siempre texto plano (textContent) para no romper Markdown.
 *
 * @param {HTMLElement} el             Contenedor destino (ej: .text.typing)
 * @param {string} text                Texto plano a escribir (sin etiquetas)
 * @param {{ speed?: number, chunk?: number, signal?: AbortSignal, onTick?: (partial:string)=>void }} [opts]
 * @returns {Promise<void>}
 */
export async function typewrite(el, text, opts = {}) {
  const speed = Number.isFinite(opts.speed) ? Math.max(1, opts.speed) : 18; // ms por tick
  const chunk = Number.isFinite(opts.chunk) ? Math.max(1, opts.chunk) : 2;  // grafemas por tick
  const signal = opts.signal;
  const onTick = typeof opts.onTick === 'function' ? opts.onTick : null;

  if (!el || typeof el.textContent === 'undefined') return;
  if (!text || !text.trim()) {
    // Nada que escribir, pero homogenizamos API
    return;
  }

  const units = splitGraphemes(text);
  let i = 0;

  while (i < units.length) {
    // Si el nodo se ha desconectado, salimos silenciosamente
    if (!el.isConnected) return;
    // Abort externo
    if (signal?.aborted) throw new Error('typing_aborted');

    const slice = units.slice(i, i + chunk).join('');
    // Añadimos texto plano (nunca HTML)
    el.append(document.createTextNode(slice));
    if (onTick) {
      try { onTick(slice); } catch { /* noop */ }
    }

    i += chunk;

    // Si aún queda texto, esperamos el intervalo
    if (i < units.length) {
      await wait(speed, signal).catch((e) => {
        // Si el error es por aborto, lo propagamos para que el caller decida
        if (String(e?.message) === 'typing_aborted') throw e;
        // Otras causas raras de setTimeout: las ignoramos
      });
    }
  }
}
