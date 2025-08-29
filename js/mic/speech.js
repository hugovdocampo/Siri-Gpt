// /js/mic/speech.js
// Dictado con webkitSpeechRecognition + callbacks y fallback a onUnavailable.
// API:
//   initSpeech({ button, input, lang, onUnavailable, onStart, onError, onEnd })
//   → retorna { start(), stop(), destroy(), getState() }

const SUPPORT = typeof window !== 'undefined' && 'webkitSpeechRecognition' in window;

/**
 * @typedef {Object} InitOpts
 * @property {HTMLButtonElement} button
 * @property {HTMLTextAreaElement} input
 * @property {string} [lang='es-ES']
 * @property {() => void} [onUnavailable]
 * @property {() => void} [onStart]
 * @property {() => void} [onError]
 * @property {(finalText:string) => void} [onEnd]
 */

/**
 * Inicializa el dictado.
 * @param {InitOpts} opts
 */
export function initSpeech(opts) {
  const btn = opts.button;
  const input = opts.input;
  const lang = (opts.lang || 'es-ES').trim();

  if (!btn || !input) {
    return dummyController(); // API no-op si faltan refs
  }

  // Sin soporte → notificar y devolver no-op
  if (!SUPPORT) {
    if (typeof opts.onUnavailable === 'function') {
      // Llamamos async para no bloquear el flujo
      setTimeout(() => opts.onUnavailable(), 0);
    }
    // Aun así enlazamos el click por si quieres reaprovecharlo
    const onClick = () => {
      if (typeof opts.onUnavailable === 'function') opts.onUnavailable();
    };
    btn.addEventListener('click', onClick);
    return {
      start() {},
      stop() {},
      getState: () => 'unavailable',
      destroy() { btn.removeEventListener('click', onClick); }
    };
  }

  // Con soporte: configuramos el reconocimiento
  /** @type {SpeechRecognition} */
  // @ts-ignore - webkitSpeechRecognition no está tipado en TS estándar
  const rec = new webkitSpeechRecognition();
  rec.lang = lang;
  rec.continuous = false;      // turno corto
  rec.interimResults = true;   // mostrar interinos
  rec.maxAlternatives = 1;

  // Estado interno
  let state = 'idle'; // 'idle' | 'listening'
  let finalText = '';

  const handleStart = () => {
    state = 'listening';
    finalText = '';
    if (typeof opts.onStart === 'function') opts.onStart();
  };

  const handleResult = (e) => {
    let interim = '';
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    // Poblar textarea con final + interino
    const t = (finalText + interim).trim();
    if (t) {
      input.value = t;
      // disparamos input para que auto-resize externo ajuste
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const handleError = () => {
    state = 'idle';
    if (typeof opts.onError === 'function') opts.onError();
  };

  const handleEnd = () => {
    state = 'idle';
    // Al terminar, dejamos solo el final (si hubo), salvo que el usuario haya tecleado algo
    if (finalText && (!input.value || input.value.trim() === '' || input.value.trim().endsWith(finalText.trim()))) {
      input.value = finalText.trim();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (typeof opts.onEnd === 'function') opts.onEnd(finalText.trim());
  };

  // Enlazar handlers
  rec.onstart = handleStart;
  rec.onresult = handleResult;
  rec.onerror = handleError;
  rec.onend = handleEnd;

  // Toggle con el botón
  const onClick = () => {
    try {
      if (state === 'listening') {
        rec.stop();
      } else {
        finalText = '';
        rec.start();
      }
    } catch {
      // En algunos WKWebView lanzar start() repetido da error
    }
  };
  btn.addEventListener('click', onClick);

  // Controlador público
  return {
    start() {
      try { finalText = ''; rec.start(); } catch {}
    },
    stop() {
      try { rec.stop(); } catch {}
    },
    getState() { return state; },
    destroy() {
      try { rec.onstart = rec.onresult = rec.onerror = rec.onend = null; } catch {}
      try { rec.abort?.(); } catch {}
      btn.removeEventListener('click', onClick);
    }
  };
}

/** Controlador no-op para cuando no se puede iniciar */
function dummyController() {
  return {
    start() {},
    stop() {},
    getState: () => 'idle',
    destroy() {}
  };
}
