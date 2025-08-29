// /js/state/history.js
// Persistencia de historial por hilo (id) usando localStorage.
// API expuesta por createHistory(id):
//   - load(), save(), clear(), get()
//   - pushUser(text, ts?), pushAssistant(text, ts?)
//   - endsWithPair(u, a)
//
// Cada item del historial: { role: 'system'|'user'|'assistant', content: string, ts: number }
// Se guarda bajo la clave: siri_ui_chat_<id>

const KEY_PREFIX = 'siri_ui_chat_';
const SYSTEM_PROMPT = 'Eres un asistente útil y conciso.';

// Límite "de almacenamiento" (podemos guardar más que lo que luego enviamos a la API)
const MAX_STORE_ITEMS = 200;
// Límite de caracteres por mensaje (coordinado con servicios/api.js)
const MAX_CHARS = 8000;
const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);

/** Sanea texto: quita controles (salvo tab/newline/CR), trim y recorte a MAX_CHARS */
function sanitizeText(s) {
  if (typeof s !== 'string') s = String(s ?? '');
  s = s.replace(/[^\x09\x0A\x0D\x20-\uFFFF]/g, '');
  s = s.trim();
  if (s.length > MAX_CHARS) s = s.slice(0, MAX_CHARS);
  return s;
}

/** Comprueba disponibilidad de localStorage sin lanzar */
function hasStorage() {
  try {
    const k = '__grooky_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** Normaliza una entrada del historial y valida */
function normalizeEntry(role, content, ts = Date.now()) {
  role = String(role || '');
  content = sanitizeText(content);
  if (!ALLOWED_ROLES.has(role)) return null;
  if (!content) return null;
  const stamp = Number.isFinite(ts) ? ts : Date.now();
  return { role, content, ts: stamp };
}

/** Garantiza que el array de historial empieza con un system prompt válido */
function ensureSystemFirst(arr) {
  if (!Array.isArray(arr) || !arr.length) {
    return [normalizeEntry('system', SYSTEM_PROMPT, Date.now())];
  }
  const first = arr[0];
  if (!first || first.role !== 'system' || !first.content) {
    // Inserta nuestro system al inicio
    arr.unshift(normalizeEntry('system', SYSTEM_PROMPT, Date.now()));
  }
  return arr;
}

/** Recorta el array a MAX_STORE_ITEMS (manteniendo el system) */
function prune(arr) {
  if (!Array.isArray(arr)) return [];
  if (arr.length <= MAX_STORE_ITEMS) return arr;
  // Conserva el primero (system) + los últimos N-1
  const head = arr[0];
  const tail = arr.slice(- (MAX_STORE_ITEMS - 1));
  return [head, ...tail];
}

/**
 * Crea la API de historial para un hilo concreto.
 * @param {string} id - Identificador del hilo (se usa en la clave de localStorage).
 */
export function createHistory(id) {
  const key = KEY_PREFIX + String(id || 'default');
  let items = []; // estado en memoria

  /** Carga desde storage a memoria. Si no existe, inicia con system prompt. */
  function load() {
    items = ensureSystemFirst([]);
    if (!hasStorage()) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        // primer uso → system prompt
        items = ensureSystemFirst([]);
        return;
      }
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        items = ensureSystemFirst([]);
        return;
      }
      // Normaliza todo lo cargado
      const tmp = [];
      for (const x of data) {
        const e = normalizeEntry(x?.role, x?.content, x?.ts);
        if (e) tmp.push(e);
      }
      items = ensureSystemFirst(prune(tmp));
    } catch {
      // Si falla el parseo, empezamos limpios
      items = ensureSystemFirst([]);
    }
  }

  /** Guarda el estado actual en storage. */
  function save() {
    if (!hasStorage()) return;
    try {
      const payload = JSON.stringify(prune(items));
      localStorage.setItem(key, payload);
    } catch {
      // si no podemos guardar, lo ignoramos (por cuota, modo privado, etc.)
    }
  }

  /** Elimina el hilo y reincia con system prompt. */
  function clear() {
    items = ensureSystemFirst([]);
    if (hasStorage()) {
      try { localStorage.removeItem(key); } catch {}
    }
  }

  /** Devuelve una copia superficial del historial actual (en memoria). */
  function get() {
    return items.slice();
  }

  /** Añade un turno de usuario (y persiste). */
  function pushUser(text, ts = Date.now()) {
    const e = normalizeEntry('user', text, ts);
    if (!e) return;
    items.push(e);
    items = prune(items);
    save();
  }

  /** Añade un turno del asistente (y persiste). */
  function pushAssistant(text, ts = Date.now()) {
    const e = normalizeEntry('assistant', text, ts);
    if (!e) return;
    items.push(e);
    items = prune(items);
    save();
  }

  /**
   * Comprueba si el historial termina con el par exacto (user=u; assistant=a).
   * Útil para evitar duplicar el primer turno al reabrir con los mismos parámetros u/a.
   */
  function endsWithPair(u, a) {
    const U = sanitizeText(u ?? '');
    const A = sanitizeText(a ?? '');
    if (!U || !A) return false;
    if (items.length < 3) return false; // [system, user, assistant] mínimo
    const last2 = items.slice(-2);
    return (
      last2[0]?.role === 'user' &&
      sanitizeText(last2[0]?.content) === U &&
      last2[1]?.role === 'assistant' &&
      sanitizeText(last2[1]?.content) === A
    );
  }

  // Devuelve el objeto público
  return {
    load,
    save,
    clear,
    get,
    pushUser,
    pushAssistant,
    endsWithPair
  };
}
