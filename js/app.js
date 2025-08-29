// /js/app.js
// Entry ESM: orquesta config, historial, seeding u/a, typing+markdown, API, mic y orbe.

import { config } from './config.js';
import { postChat } from './services/api.js';

import { createHistory } from './state/history.js';
import { seedFirstTurn } from './state/seeder.js';

import * as dom from './ui/dom.js';
import * as md from './markdown/markdown.js';
import { typewrite } from './ui/typing.js';

import { toast } from './ui/toast.js';
import { initOrb } from './ui/orb.js';
import { initSpeech } from './mic/speech.js';

console.log('[Grooky] app.js cargado', new Date().toISOString());

(async function main() {
  // Precarga de marked + DOMPurify para que el primer render ya tenga Markdown
  try { await md.ensureMarkdownReady(); } catch (e) { console.warn('Markdown preload', e); }

  // ---------- DOM refs ----------
  const $title  = /** @type {HTMLHeadingElement} */ (document.getElementById('title'));
  const $canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('grookyCanvas'));
  const $chat   = /** @type {HTMLElement} */ (document.getElementById('chat'));
  const $form   = /** @type {HTMLFormElement} */ (document.getElementById('form'));
  const $input  = /** @type {HTMLTextAreaElement} */ (document.getElementById('input'));
  const $send   = /** @type {HTMLButtonElement} */ (document.getElementById('send'));
  const $mic    = /** @type {HTMLButtonElement} */ (document.getElementById('mic'));

  // ---------- Título ----------
  if (config.title) $title.textContent = config.title;

  // ---------- Orb (canvas) ----------
  try { initOrb($canvas); } catch { /* no-op si algo falla */ }

  // ========== **PRO**: medir altura del composer y detectar teclado ==========
  // - Ajusta padding inferior del chat según:
  //   a) Altura real del composer (form)
  //   b) Altura estimada del teclado virtual (visualViewport en iOS/Safari)
  // - Expone CSS vars: --composer-h, --kb-h, --vh
  const setVar = (k, v) => document.documentElement.style.setProperty(k, v);

  function measureComposerHeight() {
    if (!$form) return 0;
    const r = $form.getBoundingClientRect();
    const h = Math.max(0, Math.round(r.height));
    setVar('--composer-h', h + 'px');
    return h;
  }

  // visualViewport: calcula “keyboard height” aproximado
  function computeKeyboardHeight() {
    const vv = window.visualViewport;
    if (!vv) return 0;
    // Cuando aparece el teclado, suele reducir vv.height
    // y vv.offsetTop puede no ser 0 en iOS.
    const occupied = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    return Math.round(occupied);
  }

  function updateVH() {
    // 1% del viewport real (útil si tu CSS usa var(--vh))
    const unit = (window.visualViewport ? window.visualViewport.height : window.innerHeight) / 100;
    setVar('--vh', unit + 'px');
  }

  // Ajusta el padding del contenedor de chat
  function applyChatInsets({ scroll = false } = {}) {
    const ch = measureComposerHeight();
    const kb = computeKeyboardHeight();
    setVar('--kb-h', kb + 'px');

    // Nota: normalmente con el CSS que ya cambiaste bastaría con las vars.
    // Para asegurar compatibilidad, ajusto también el paddingBottom directo:
    const extraGap = 8; // pequeño margen
    $chat.style.paddingBottom = (ch + extraGap) + 'px';

    if (scroll) dom.scrollToEnd($chat);
  }

  // Observadores:
  // 1) visualViewport (apertura/cierre de teclado, barra de URL en iOS, etc.)
  const onVVChange = () => {
    updateVH();
    // Cuando el teclado se abre/cierra, reacomodamos y opcionalmente scroll
    applyChatInsets({ scroll: true });
  };
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onVVChange);
    window.visualViewport.addEventListener('scroll', onVVChange); // iOS cambia offsetTop
  } else {
    // Fallback si no existe visualViewport
    window.addEventListener('resize', () => applyChatInsets({ scroll: true }));
  }

  // 2) Resize del composer (textarea auto-crece, botones, etc.)
  const ro = new ResizeObserver(() => applyChatInsets({ scroll: false }));
  try { ro.observe($form); } catch { /* no-op */ }
  try { ro.observe($input); } catch { /* no-op */ }

  // Inicializa variables y padding
  updateVH();
  applyChatInsets({ scroll: false });

  // ---------- Historial ----------
  const history = createHistory(config.id);
  if (config.reset) history.clear(); // limpiar hilo si ?reset=1
  history.load();

  // Render inicial si hubiera algo previo
  dom.renderAll($chat, history.get(), { markdown: md.render });
  dom.scrollToEnd($chat);

  // ---------- Micrófono ----------
  initSpeech({
    button: $mic,
    input: $input,
    lang: config.voice,
    onUnavailable() {
      toast('Dictado no disponible aquí. Abriendo en Safari…');
      const a = document.createElement('a');
      a.href = location.href; a.target = '_blank'; a.rel = 'noopener'; a.click();
    },
    onStart()  { $mic.classList.add('rec'); toast('Escuchando…'); },
    onError()  { $mic.classList.remove('rec'); toast('No se pudo usar el dictado'); },
    onEnd(finalText) {
      $mic.classList.remove('rec');
      if (finalText && !$input.value.trim()) {
        $input.value = finalText;
        autoResize($input);
        // Al crecer el textarea, re‑mide composer y baja el scroll
        applyChatInsets({ scroll: true });
      }
      // Si quieres auto-enviar tras dictar, descomenta:
      // if ($input.value.trim()) $form.requestSubmit();
    }
  });

  // ---------- Seeding primer turno (caso 2 u/a o sólo u) ----------
  try {
    await seedFirstTurn({
      config,
      history,
      chatEl: $chat,
      dom,
      md,
      typewrite
    });
  } catch (e) {
    console.error('Seeder error', e);
    toast('No se pudo pintar el primer turno');
  }

  // ---------- Auto-resize del textarea ----------
  $input.addEventListener('input', () => {
    autoResize($input);
    // El composer cambia de altura → re‑mide y corrige padding
    applyChatInsets({ scroll: false });
  });
  autoResize($input);

  // ---------- Envío de nuevos mensajes ----------
  $form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ($input.value || '').trim();
    if (!text) return;

    // Vaciar input
    $input.value = '';
    autoResize($input);
    applyChatInsets({ scroll: false });

    // Añadir usuario al historial + pintar
    const tsUser = Date.now();
    history.pushUser(text, tsUser);
    dom.renderRow($chat, 'user', text, tsUser, { markdown: false });

    // Placeholder de typing para Grooky
    const tsNow = Date.now();
    const typingEl = dom.startTypingSkeleton($chat, tsNow);

    disableComposer(true);

    try {
      // Preparar mensajes solo con {role, content}
      const msgs = history.get().map(({ role, content }) => ({ role, content }));

      // Llamada a API
      const reply = await postChat({
        model: config.model,
        messages: msgs
      });

      // Typing plano y luego Markdown
      await typewrite(typingEl, md.strip(reply), { speed: config.speed, chunk: config.chunk });
      typingEl.classList.remove('typing');
      typingEl.innerHTML = md.render(reply);

      // Guardar en historial y persistir
      history.pushAssistant(reply, Date.now());
      history.save();

      // Scroll al final
      dom.scrollToEnd($chat);
    } catch (err) {
      typingEl.classList.remove('typing');
      typingEl.textContent = `⚠️ ${err?.message || 'Fallo inesperado'}`;
      console.error('postChat error', err);
    } finally {
      disableComposer(false);
      // Tras cualquier envío, asegura que el padding está bien
      applyChatInsets({ scroll: false });
    }
  });

  // ---------- Utilidades locales ----------
  function disableComposer(disabled) {
    $send.disabled = disabled;
    $input.disabled = disabled;
    $mic.disabled = disabled;
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(120, el.scrollHeight) + 'px';
  }
})();
