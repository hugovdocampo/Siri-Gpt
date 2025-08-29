// /js/state/seeder.js
// Siembra el primer turno en la UI según los parámetros de config:
//  0) seed: token para recuperar {u,a} desde /api/seed (evita límites de URL y recalcular).
//  1) Caso 2: u (o q) + a → pinta user + typing de a (strip) y luego render (Markdown) + guarda.
//  2) Solo u → pre-rellena el textarea para que el usuario pueda enviar manualmente.

/**
 * @typedef {Object} SeederDeps
 * @property {{ id:string, title:string, model:string, speed:number, chunk:number, reset:boolean, voice:string, u?:string, a?:string, seed?:string }} config
 * @property {{ load:Function, save:Function, clear:Function, get:Function, pushUser:Function, pushAssistant:Function, endsWithPair?:Function }} history
 * @property {HTMLElement} chatEl
 * @property {{ renderAll:Function, renderRow:Function, startTypingSkeleton:Function, scrollToEnd?:Function }} dom
 * @property {{ render:(md:string)=>string, strip:(md:string)=>string }} md
 * @property {(el:HTMLElement, text:string, opts:{speed:number, chunk:number})=>Promise<void>} typewrite
 */

/**
 * Siembra el primer turno en la UI (seed token / u+a / u).
 * @param {SeederDeps} deps
 */
export async function seedFirstTurn({ config, history, chatEl, dom, md, typewrite }) {
  const u    = (config.u    || '').trim();
  const a    = (config.a    || '').trim();
  const seed = (config.seed || '').trim();

  // ---------- 0) Sembrado por token (seed) ----------
  // Recupera {u,a} desde /api/seed?token=... para evitar cortes por longitud de URL
  if (seed) {
    try {
      const r = await fetch(`/api/seed?token=${encodeURIComponent(seed)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'seed fetch error');

      const uu = String(data.u || '').trim();
      const aa = String(data.a || '').trim();

      // Si el token trae un par válido, pínchalo y guarda
      if (uu && aa) {
        // Evita duplicar si ya lo tienes al final (por reapertura del mismo id)
        if (typeof history.endsWithPair === 'function' && history.endsWithPair(uu, aa)) {
          return;
        }

        // 1) Turno del usuario
        const tsU = Date.now();
        history.pushUser(uu, tsU);
        dom.renderRow(chatEl, 'user', uu, tsU, { markdown: false });

        // 2) Typing de Grooky (texto plano para no romper Markdown al cortar)
        const tsA = Date.now();
        const typingEl = dom.startTypingSkeleton(chatEl, tsA);
        await typewrite(typingEl, md.strip(aa), { speed: config.speed, chunk: config.chunk });

        // 3) Sustituimos por Markdown seguro + persistimos
        typingEl.classList.remove('typing');
        typingEl.innerHTML = md.render(aa);

        history.pushAssistant(aa, Date.now());
        history.save();

        if (typeof dom.scrollToEnd === 'function') dom.scrollToEnd(chatEl);
        return; // ✅ Sembrado vía token completo
      }
      // Si el token no devolvió par válido, continúa con el flujo normal (u/a)
    } catch (e) {
      console.warn('[Seeder] seed error:', e);
      // Continúa con flujo u/a o solo u
    }
  }

  // Si no hay nada que sembrar, salir
  if (!u && !a) return;

  // ---------- 1) Caso 2: u y a presentes ----------
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

    // 3) Efecto "máquina de escribir" con texto plano (evita romper etiquetas)
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

  // ---------- 2) Solo u (sin a): pre-rellena el composer ----------
  if (u && !a) {
    const $input = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('input'));
    if ($input) {
      $input.value = u;
      // Disparar 'input' para auto-resize desde app.js
      $input.dispatchEvent(new Event('input', { bubbles: true }));
      // Opcional: desplazar vista hacia el composer
      $input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
