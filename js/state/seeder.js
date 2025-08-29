// /js/state/seeder.js
// Siembra el primer turno en la UI según los parámetros de config:
//  - Caso 2: u (o q) y a → pinta user + typing de a (strip) y luego render (markdown) + guarda.
//  - Solo u → pre-rellena el textarea para que el usuario pueda enviar manualmente.

export async function seedFirstTurn({ config, history, chatEl, dom, md, typewrite }) {
  const u = (config.u || '').trim();
  const a = (config.a || '').trim();

  // Nada que sembrar
  if (!u && !a) return;

  // Caso 2: u y a presentes
  if (u && a) {
    // Evitar duplicado si el hilo ya termina con ese par exacto
    if (typeof history.endsWithPair === 'function' && history.endsWithPair(u, a)) {
      return;
    }

    // 1) Pinta y guarda el turno del usuario
    const tsU = Date.now();
    history.pushUser(u, tsU);
    dom.renderRow(chatEl, 'user', u, tsU, { markdown: false });

    // 2) Skeleton de typing para Grooky
    const tsA = Date.now();
    const typingEl = dom.startTypingSkeleton(chatEl, tsA);

    // 3) Efecto máquina de escribir con texto plano (sin etiquetas)
    await typewrite(typingEl, md.strip(a), { speed: config.speed, chunk: config.chunk });

    // 4) Sustituye por HTML ya formateado (Markdown seguro)
    typingEl.classList.remove('typing');
    typingEl.innerHTML = md.render(a);

    // 5) Guarda turno del asistente y persiste
    history.pushAssistant(a, Date.now());
    history.save();

    // 6) Scroll al final por estética
    if (typeof dom.scrollToEnd === 'function') dom.scrollToEnd(chatEl);
    return;
  }

  // Sólo u (sin a): pre-rellena el composer y ajusta altura.
  // Nota: no enviamos automáticamente aquí; el usuario decidirá (mantiene coherencia con la lectura de Siri por Atajos).
  if (u && !a) {
    const $input = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('input'));
    if ($input) {
      $input.value = u;
      // Disparar 'input' para que un listener de auto-resize ajuste la altura
      $input.dispatchEvent(new Event('input', { bubbles: true }));
      // Scroll opcional hacia el composer
      $input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
