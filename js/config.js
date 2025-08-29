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

// Sembrado del primer turno (caso 2)
const u = (safeParam(qs, 'u') || safeParam(qs, 'q') || '').trim();
const a = safeParam(qs, 'a', '').trim();

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

