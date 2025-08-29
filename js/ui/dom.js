// /js/ui/dom.js
// Render del timeline (mensajes), skeleton de typing y utilidades de scroll.
// Se apoya en las clases CSS: .msg, .bubble, .who, .text, .meta
// y en las funciones md.render / escape internas según 'markdown: true|false'.

/**
 * Renderiza todo el historial.
 * @param {HTMLElement} chatEl
 * @param {Array<{role:'system'|'user'|'assistant', content:string, ts:number}>} history
 * @param {{ markdown: (mdText:string)=>string }} opts
 */
export function renderAll(chatEl, history, { markdown }) {
  if (!chatEl) return;
  chatEl.innerHTML = '';
  if (!Array.isArray(history)) return;

  for (const m of history) {
    if (m.role === 'system') continue; // no pintamos el system prompt
    renderRow(chatEl, m.role, m.content, m.ts, {
      markdown: m.role === 'assistant' ? markdown : false
    });
  }
  scrollToEnd(chatEl);
}

/**
 * Pinta una burbuja en el timeline y la agrega al final.
 * @param {HTMLElement} chatEl
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @param {number} ts
 * @param {{ markdown: false | ((mdText:string)=>string) }} opts
 * @returns {HTMLElement} el nodo .msg creado
 */
export function renderRow(chatEl, role, content, ts, { markdown }) {
  if (!chatEl) return null;

  const msg = document.createElement('div');
  msg.className = `msg ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = role === 'user' ? 'Tú' : 'Grooky';

  const text = document.createElement('div');
  text.className = 'text';
  // Render seguro: si se pide markdown, usar función recibida; si no, escapar
  if (markdown && typeof markdown === 'function' && role === 'assistant') {
    text.innerHTML = markdown(content || '');
  } else {
    text.textContent = String(content || '');
  }

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = fmtTime(ts);

  bubble.appendChild(who);
  bubble.appendChild(text);
  bubble.appendChild(meta);

  msg.appendChild(bubble);
  chatEl.appendChild(msg);

  return msg;
}

/**
 * Crea la burbuja de Grooky con un contenedor de texto que muestra el caret
 * y devuelve ese elemento `.text` para que el caller pueda hacer typing.
 * @param {HTMLElement} chatEl
 * @param {number} ts
 * @returns {HTMLElement} el contenedor `.text` con clase `typing`
 */
export function startTypingSkeleton(chatEl, ts) {
  if (!chatEl) return null;

  const msg = document.createElement('div');
  msg.className = 'msg assistant';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = 'Grooky';

  const text = document.createElement('div');
  text.className = 'text typing'; // ← sobre este nodo se hace el typewrite

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = fmtTime(ts);

  bubble.appendChild(who);
  bubble.appendChild(text);
  bubble.appendChild(meta);

  msg.appendChild(bubble);
  chatEl.appendChild(msg);

  scrollToEnd(chatEl);
  return text;
}

/**
 * Hace scroll suave al final del contenedor del chat.
 * @param {HTMLElement} chatEl
 */
export function scrollToEnd(chatEl) {
  try {
    chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  } catch {
    // Fallback
    chatEl.scrollTop = chatEl.scrollHeight;
  }
}

/* ==================== helpers locales ==================== */

/** Formatea HH:MM con padding de cero */
function fmtTime(ts) {
  const d = new Date(Number.isFinite(ts) ? ts : Date.now());
  const h = d.getHours();
  const m = d.getMinutes();
  return `${pad2(h)}:${pad2(m)}`;
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}
