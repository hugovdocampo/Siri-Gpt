// /js/ui/toast.js
// Toast minimalista para avisos rápidos.
// Usa el estilo .toast definido en base.css

let currentToast = null;
let currentTimer = null;

/**
 * Muestra un toast temporal.
 * @param {string} message  Texto a mostrar
 * @param {number} [ms=1800] Duración en ms
 * @param {'ok'|'warn'|'error'} [type] Tipo opcional (para clases adicionales)
 */
export function toast(message, ms = 1800, type) {
  try { removeToast(); } catch {}

  const t = document.createElement('div');
  t.className = 'toast';
  if (type) t.classList.add(`toast-${type}`); // por si añades estilos específicos
  t.textContent = String(message ?? '');

  document.body.appendChild(t);
  currentToast = t;

  currentTimer = setTimeout(() => removeToast(), Math.max(500, ms));
}

/** Elimina el toast actual inmediatamente */
export function removeToast() {
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
  if (currentToast && currentToast.parentNode) {
    currentToast.parentNode.removeChild(currentToast);
  }
  currentToast = null;
}
