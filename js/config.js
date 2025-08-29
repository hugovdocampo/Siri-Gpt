// /js/config.js
// Lee parámetros de la URL y expone un objeto de configuración consistente.
// Soporta tu "caso 2": sembrar primer turno con ?u= (o ?q=) y ?a=.

function clamp(n, min, max) {
  n = Number.isFinite(n) ? n : min;
  return Math.max(min, Math.min(max, n));
}

function parseIntClamped(v, def, min, max) {
  const num = Number.parseInt(v, 10);
  return clamp(Number.isFinite(num) ? num : def, min, max);
}

function safeParam(qs, key, def = '') {
  const raw = qs.get(key);
  if (!raw) return def;
  try {
    // Muchos atajos ya vienen codificados; por si acaso, toleramos ambos casos.
    return decodeURIComponent(raw);
  } catch {
    return String(raw);
  }
}

const qs = new URLSearchParams(location.search);
// Lee también parámetros del hash (#u_b64=...&a_b64=...)
const hash = location.hash.startsWith('#') ? location.hash.slice(1) : '';
const hsp  = new URLSearchParams(hash);

// Decodificador Base64 → UTF-8 (seguro)
function b64ToUtf8(b64) {
  try {
    if (window.TextDecoder) {
      const bin = atob(b64);
      const bytes = new Uint8Array([...bin].map(ch => ch.charCodeAt(0)));
      return new TextDecoder('utf-8').decode(bytes);
    }
  } catch {}

  try {
    // Fallback universal
    return decodeURIComponent(
      Array.prototype.map.call(atob(b64), c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
  } catch {
    return '';
  }
}

// Sembrado del primer turno (caso 2)
const uFromHash = hsp.get('u_b64') ? b64ToUtf8(hsp.get('u_b64')) : '';
const aFromHash = hsp.get('a_b64') ? b64ToUtf8(hsp.get('a_b64')) : '';
const u = (uFromHash || safeParam(qs, 'u') || safeParam(qs, 'q') || '').trim();
const a = (aFromHash || safeParam(qs, 'a', '')).trim();

// Identidad del hilo
const id = (qs.get('id') || `t_${Math.random().toString(36).slice(2, 10)}`).trim();

// Visual y modelo
const title = (qs.get('title') || 'Grooky').trim();
const model = (qs.get('model') || 'llama-3.3-70b-versatile').trim();

// Efecto "máquina de escribir"
const speed = parseIntClamped(qs.get('speed'), 18, 1, 100); // ms por tick
const chunk = parseIntClamped(qs.get('chunk'), 2, 1, 32);   // chars por tick

// Otros
const reset = qs.get('reset') === '1';
const voice = (qs.get('voice') || 'es-ES').trim();

export const config = {
  id,
  title,
  model,
  speed,
  chunk,
  reset,
  voice,
  u,
  a
};

