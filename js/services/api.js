// /js/services/api.js
// Cliente de la API serverless (/api/siri-gpt).
// - Envía solo {role, content} (saneado) y el modelo seleccionado.
// - Timeout con AbortController para no colgar la UI.
// - Devuelve el "response" como string o lanza Error descriptivo.

const API_URL = '/api/siri-gpt';
const TIMEOUT_MS = 30000;
const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
const MAX_MSGS = 64;
const MAX_CHARS = 8000;

function sanitizeText(s) {
  if (typeof s !== 'string') s = String(s ?? '');
  // Quita controles salvo \t \n \r
  s = s.replace(/[^\x09\x0A\x0D\x20-\uFFFF]/g, '');
  s = s.trim();
  if (s.length > MAX_CHARS) s = s.slice(0, MAX_CHARS);
  return s;
}

function sanitizeMessages(messages) {
  const out = [];
  if (!Array.isArray(messages)) return out;
  for (const m of messages) {
    const role = sanitizeText(m?.role || '');
    const content = sanitizeText(m?.content || '');
    if (!ALLOWED_ROLES.has(role)) continue;
    if (!content) continue;
    out.push({ role, content });
    if (out.length >= MAX_MSGS) break;
  }
  return out;
}

/**
 * Llama al backend con historial completo y devuelve el texto de la respuesta.
 * @param {{model:string, messages:Array<{role:string, content:string}>, temperature?:number}} opts
 * @returns {Promise<string>}
 */
export async function postChat({ model, messages, temperature = 0.4 }) {
  const msgs = sanitizeMessages(messages);
  if (!msgs.length) throw new Error('No hay mensajes válidos que enviar');

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: msgs, temperature })
    });

    const text = await res.text(); // leemos crudo por si no es JSON
    let data;
    try { data = JSON.parse(text); }
    catch {
      throw new Error(`Respuesta no JSON del backend (${res.status})`);
    }

    if (!res.ok) {
      // El serverless ya devuelve { error, details } → lo exponemos legible
      const details = typeof data === 'object' ? JSON.stringify(data.details ?? data) : String(data);
      throw new Error(data.error ? `${data.error} · ${details}` : `Error ${res.status} · ${details}`);
    }

    const reply = (data?.response || '').trim();
    if (!reply) throw new Error('Backend sin contenido en "response"');
    return reply;
  } catch (err) {
    // Diferenciar abort de otros errores
    if (err?.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al llamar a la API');
    }
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(t);
  }
}

/**
 * Ping opcional de salud para depurar despliegues / variables de entorno.
 * @returns {Promise<{ok:boolean, envOk:boolean, now:string}>}
 */
export async function pingHealth() {
  const res = await fetch(API_URL, { method: 'GET' });
  if (!res.ok) throw new Error(`Health check falló (${res.status})`);
  return res.json();
}
