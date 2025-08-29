// /js/app.js
// Entry ESM: orquesta config, historial, seeding u/a, typing+markdown, API, mic y orbe.

import { config } from './config.js';
import { postChat } from './services/api.js';

import { createHistory } from './state/history.js';
import { seedFirstTurn } from './state/seeder.js';

import * as dom from './ui/dom.js';
import { typewrite } from './ui/typing.js';
import { toast } from './ui/toast.js';
import { initOrb } from './ui/orb.js';

import * as md from './markdown/markdown.js';
import { initSpeech } from './mic/speech.js';

(async function main() {
  // ---------- DOM refs ----------
  const $title = /** @type {HTMLHeadingElement} */ (document.getElementById('title'));
  const $canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('grookyCanvas'));
  const $chat = /** @type {HTMLElement} */ (document.getElementById('chat'));
  const $form = /** @type {HTMLFormElement} */ (document.getElementById('form'));
  const $input = /** @type {HTMLTextAreaElement} */ (document.getElementById('input'));
  const $send = /** @type {HTMLButtonElement} */ (document.getElementById('send'));
  const $mic = /** @type {HTMLButtonElement} */ (document.getElementById('mic'));

  // ---------- Título ----------
  if (config.title) $title.textContent = config.title;

  // ---------- Orb (canvas) ----------
  try { initOrb($canvas); } catch { /* no-op si algo falla */ }

  // ---------- Historial ----------
  const history = createHistory(config.id);
  if (config.reset) history.clear(); // limpiar hilo si ?reset=1
  history.load();
  // Render inicial si hubiera algo previo
  dom.renderAll($chat, history.get(), { markdown: md.render });

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
    onStart() { $mic.classList.add('rec'); toast('Escuchando…'); },
    onError() { $mic.classList.remove('rec'); toast('No se pudo usar el dictado'); },
    onEnd(finalText) {
      $mic.classList.remove('rec');
      if (finalText && !$input.value.trim()) {
        $input.value = finalText;
        autoResize($input);
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
  $input.addEventListener('input', () => autoResize($input));
  autoResize($input);

  // ---------- Envío de nuevos mensajes ----------
  $form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ($input.value || '').trim();
    if (!text) return;

    // Vaciar input
    $input.value = '';
    autoResize($input);

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
