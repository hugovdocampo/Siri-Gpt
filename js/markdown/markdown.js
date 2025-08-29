// /js/markdown/markdown.js
// Render Markdown seguro (marked + DOMPurify) y "strip" para typing.
// Carga dinámica por CDN; regex bien formados (sin dobles backslashes).

const CDN = {
  marked: 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
  dompurify: 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js'
};

let _loaded = false;

/** Inserta <script src="..."> y espera a que cargue o falle */
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

  if (!window.marked)    await loadScript(CDN.marked);
  if (!window.DOMPurify) await loadScript(CDN.dompurify);

  try {
    window.marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: false,
      mangle: false
    });
  } catch { /* ok */ }

  _loaded = true;
}

/** Añade target/rel seguros a los enlaces */
function addLinkAttrs(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('a[href]').forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow';
  });
  return div.innerHTML;
}

/** Escapa HTML básico (fallback) */
function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[ch]));
}

/**
 * Renderiza Markdown a HTML seguro.
 * @param {string} mdText
 * @returns {string}
 */
export function render(mdText) {
  const src = typeof mdText === 'string' ? mdText : String(mdText ?? '');
  if (!src.trim()) return '';

  // Si llegamos antes de que carguen las libs, devolvemos texto escapado y disparamos la carga.
  if (!_loaded || !window.marked || !window.DOMPurify) {
    queueMicrotask(() => ensureLoaded().catch(console.error));
    return escapeHTML(src);
  }

  const raw = window.marked.parse(src);
  const clean = window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  return addLinkAttrs(clean);
}

/* ==================== strip (para typing) ==================== */
/* Literales REGEXP correctos (una sola barra invertida).       */

// Code fences ```...```
const RE_FENCE        = /```[\s\S]*?```/g;
// Inline code `...`
const RE_INLINE       = /`([^`]+)`/g;
// Negritas / itálicas
const RE_BOLD_ASTER   = /\*\*([^*]+)\*\*/g;
const RE_ITALIC_ASTER = /\*([^*]+)\*/g;
const RE_BOLD_UNDER   = /__([^_]+)__/g;
const RE_ITALIC_UNDER = /_([^_]+)_/g;
// Imágenes !alt
const RE_IMAGE        = /!\\[[^\\]]*\]\\([^)]+\\)/g;
// Enlaces text
const RE_LINK         = /\\[([^\\]]+)\]\\(([^)]+)\\)/g;
// Listas
const RE_UL_BULLET    = /^\s*[-*+]\s+/gm;
const RE_OL_NUM       = /^\s*\d+\.\s+/gm;
// Tablas / separadores
const RE_TABLE_ROW    = /^\|.*\|$/gm;
const RE_HR           = /^---+$/gm;

/**
 * Convierte Markdown a texto plano legible para el typing.
 * @param {string} mdText
 * @returns {string}
 */
export function strip(mdText = '') {
  return String(mdText ?? '')
    .replace(RE_FENCE, s => s.replace(/```/g, ''))
    .replace(RE_INLINE, '$1')
    .replace(RE_BOLD_ASTER, '$1')
    .replace(RE_ITALIC_ASTER, '$1')
    .replace(RE_BOLD_UNDER, '$1')
    .replace(RE_ITALIC_UNDER, '$1')
    .replace(RE_IMAGE, '')
    .replace(RE_LINK, '$1')
    .replace(RE_UL_BULLET, '• ')
    .replace(RE_OL_NUM, m => m)
    .replace(RE_TABLE_ROW, s => s.replace(/\|/g, ' ').trim())
    .replace(RE_HR, '—')
    .trim();
}

/** Permite precargar explícitamente desde app.js */
export async function ensureMarkdownReady() {
  await ensureLoaded();
}
