// /js/markdown/markdown.js
// Render de Markdown seguro (marked + DOMPurify) y "strip" para typing.
// Carga dinámica por CDN (evita que ui.html tenga URLs sueltas).

const CDN = {
  marked: 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
  dompurify: 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js'
};

let _loaded = false;

/** Inserta un <script src="..."> y espera a que cargue o falle */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
    document.head.appendChild(s);
  });
}

/** Carga marked y DOMPurify si aún no están disponibles */
async function ensureLoaded() {
  if (_loaded && window.marked && window.DOMPurify) return;

  if (!window.marked)   await loadScript(CDN.marked);
  if (!window.DOMPurify) await loadScript(CDN.dompurify);

  // Config básica de marked
  try {
    window.marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: false,
      mangle: false
    });
  } catch { /* no-op si versión sin setOptions */ }

  _loaded = true;
}

/** Añade target/rel seguros a enlaces del HTML ya sanitizado */
function addLinkAttrs(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('a[href]').forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow';
  });
  return div.innerHTML;
}

/**
 * Renderiza Markdown a HTML seguro.
 * - Usa marked para parsear
 * - Sanitiza con DOMPurify
 * - Ajusta enlaces (target/rel)
 * @param {string} mdText
 * @returns {string} HTML
 */
export function render(mdText) {
  const src = typeof mdText === 'string' ? mdText : String(mdText ?? '');
  if (!src.trim()) return '';
  // NOTA: no hacemos await aquí; app.js/seeder esperan que sea sync.
  // Aseguramos carga previa cuando app.js arranca (primera llamada puede pagar la carga, es rápido).
  if (!_loaded || !window.marked || !window.DOMPurify) {
    // Carga perezosa sin bloquear en exceso: devolvemos texto escapado
    // y que la próxima llamada ya traiga las libs. (Opcional)
    queueMicrotask(() => ensureLoaded().catch(console.error));
    return escapeHTML(src);
  }
  const raw = window.marked.parse(src);
  const clean = window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  return addLinkAttrs(clean);
}

/**
 * Convierte Markdown a texto plano para "typing"
 * (evita cortar etiquetas y queda legible).
 * @param {string} mdText
 * @returns {string}
 */
export function strip(mdText = '') {
  return String(mdText ?? '')
    // code fences → texto interior
    .replace(/```[\s\S]*?```/g, s => s.replace(/```/g, ''))
    // inline code
    .replace(/`([^`]+)`/g, '$1')
    // **bold**, *italic*, __bold__, _italic_
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // imágenes: fuera
    .replace(/!\\[[^\\]]*]\\([^)]*\\)/g, '')
    // links: deja el texto
    .replace(/\\[([^\\]
]+)\]\\(([^)]+)\\)/g, '$1')
    // listas: bullets normales
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, m => m)
    // tablas y HR se degradan a texto plano
    .replace(/^\|.*\|$/gm, s => s.replace(/\|/g, ' ').trim())
    .replace(/^---+$/gm, '—')
    .trim();
}

/** Escapa HTML básico para fallback sin libs */
function escapeHTML(s) {
  return s.replace(/[&<>"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[ch]));
}

/** (Opcional) expone el loader por si quieres forzar la precarga desde app.js */
export async function ensureMarkdownReady() {
  await ensureLoaded();
}
