# 🟡🟢 Grooky — Tu asistente conversacional con voz + UI web > **Habla. Escucha. Ve.** > Grooky une **Siri (Atajos)**, **Groq** y una **UI de chat** ultraligera para darte respuestas con **voz** y **formato rico** (Markdown, tablas, código), en un flujo pensado para móvil. !Grooky Cover --- ## ✨ Por qué te va a encantar - **Arranque por voz**: dicta a Siri; Grooky responde **en voz** y la conversación se **siembra** en la UI (primer turno `u/a`) sin recalcular. - **Formato pro**: render Markdown **seguro** (negritas, listas, **tablas**, `code`, enlaces) y efecto **typing** agradable. - **Historial por hilo**: cada conversación vive en `localStorage` con su propio `id` (ideal para reanudar). - **Micrófono in‑app**: botón 🎙️ minimal con *fallback* a **Safari** cuando la Vista Web de Atajos no soporta dictado. - **Diseño con personalidad**: orbe animado **amarillo + verde‑azul** estilo Siri, tema oscuro y UX compacta. --- ## 🧪 Demo rápida - UI vacía **`https://siri-gpt.vercel.app/ui.html`** - Sembrado (caso 2; abre en Safari): https://siri-gpt.vercel.app/ui.html ?u=Hola%20Grooky &a=%2A%2ARespuesta%2A%2A%20con%20%60c%C3%B3digo%60%20y%20tabla%3A%0A%0A%7CCol1%7CCol2%7C%0A%7C---%7C---%7C%0A%7CA%7CB%7C &id=hilo-demo &model=llama-3.3-70b-versatile &speed=18 &chunk=2
> 💡 Usa `&reset=1` solo la **primera** vez con cada `id` si quieres arrancar limpio. --- ## 🚀 Qué resuelve (y cómo) 1. **Quiero hablar y que me contesten por voz** → Atajos hace `POST /api/siri-gpt` con tu dictado y Siri lee la respuesta. 2. **Quiero seguir en pantalla** → la UI abre con `u=` y `a=` ya puestos; ves tu pregunta y el typing de la respuesta **sin recalcular**. 3. **Quiero formato bonito** → Markdown seguro con **DOMPurify**; tabla/código/citas/listas se ven perfectos. 4. **Quiero retomar más tarde** → cada hilo tiene su `id`; la conversación queda en `localStorage`. --- ## 🧩 Arquitectura Atajo (iOS) ├─ Dictas → PREGUNTA ├─ POST /api/siri-gpt { message: PREGUNTA } → RESPUESTA ├─ Siri lee RESPUESTA (voz) └─ Abre UI: /ui.html?u=&a=&id=
UI (ESM + módulos) ├─ Siembra primer turno (u/a) con typing + Markdown ├─ Historial por id (localStorage) ├─ Turnos siguientes → POST /api/siri-gpt { messages[] } └─ Mic in‑app (fallback a Safari si no hay Speech API)
Serverless (Vercel) └─ /api/siri-gpt → Groq (OpenAI‑like) → { response }
--- ## 🧭 Parámetros de la UI | parámetro | qué hace | ejemplo | |---|---|---| | `u` | primer mensaje del usuario (acepta `q`) | `u=Hola%20Grooky` | | `a` | primera respuesta ya calculada | `a=%2A%2AOK%2A%2A` | | `id` | identificador del hilo (localStorage) | `id=hilo1` | | `reset` | `1` limpia el hilo `id` al abrir | `reset=1` | | `model` | modelo Groq | `llama-3.3-70b-versatile` | | `speed` | ms por tick typing (default `18`) | `speed=18` | | `chunk` | chars por tick typing (default `2`) | `chunk=2` | | `title` | título de la UI | `title=Grooky` | | `voice` | idioma dictado | `es-ES` | **Ejemplo:** `/ui.html?u=Hola%20Grooky&a=**OK**&id=hilo1&model=llama-3.3-70b-versatile&speed=18&chunk=2` --- ## 🎤 Atajos (Shortcuts) – Caso 2 (voz + sembrado) **Flujo recomendado:** 1. **Dictar texto** → `PREGUNTA` 2. **POST** a `https://siri-gpt.vercel.app/api/siri-gpt` con body: ```json { "message": "PREGUNTA" } → devuelve RESPUESTA 3. Hablar texto → RESPUESTA (sin “esperar hasta que acabe” o usa “Hablar texto”). 4. Codificar URL → PREGUNTA → PREG_URL 5. Codificar URL → RESPUESTA → RESP_URL 6. Mostrar vista web con:
https://siri-gpt.vercel.app/ui.html?u=&a=&id=hilo1&model=llama-3.3-70b-versatile&speed=18&chunk=2 (opcional primera vez con ese id: &reset=1)
Evita 404: sin espacios “sueltos”; codifica ** → %2A%2A, | → %7C, ó → %C3%B3.
⸻
🔌 API
POST https://siri-gpt.vercel.app/api/siri-gpt
- Turno único:
{ "message": "..." } - Chat:
{ "model": "llama-3.3-70b-versatile", "messages": [ {"role":"system","content":"Eres un asistente útil y conciso."}, {"role":"user","content":"Hola"} ], "temperature": 0.4 } Respuesta:
{ "response": "..." } El backend sanea a { role, content } antes de llamar a Groq. Errores siempre en JSON.
⸻
🧰 Despliegue
- Hosting: Vercel (Node ≥ 18).
- Env: GROQ_API_KEY en Project → Settings → Environment Variables.
- URL: https://siri-gpt.vercel.app/ui.html
Durante desarrollo, puedes forzar recarga con ?v=YYYYMMDD en CSS/JS y poner no-store temporal en vercel.json.
⸻
🔒 Privacidad & seguridad
- Historial en localStorage (por id) en el navegador.
- Markdown sanitizado con DOMPurify.
- Cabeceras anti‑sniff y referrer limitado.
- Respeta prefers-reduced-motion y accesibilidad básica (focus visible, aria-live).
⸻
📸 Capturas (sugerencia)
Coloca estas imágenes en /assets/ y enlázalas:
- assets/cover.png — hero image de Grooky
- assets/chat.png — conversación con tabla/código
- assets/voice.png — dictado + UI
!Chat con tablas ⸻
🐞 Troubleshooting
- No se ve la respuesta de la IA → en chat.css usa:
.msg:has(.text:not(.typing):empty) { display: none; } - Logo gigante → fuerza tamaño:
#grookyCanvas{ width:30px; height:30px; max-width:30px; max-height:30px; } - Se mezclan conversaciones → usa id único o &reset=1 al abrir.
- Dictado no va en Atajos → limitación de WKWebView; la UI abrirá Safari como fallback.
⸻
🗺️ Roadmap
- Streaming SSE (tokens en tiempo real)
- Botón Nuevo chat (genera id nuevo)
- Export a JSON/Markdown
- Tema claro/oscuro automático
⸻
🧑‍💻 Autor
Grooky — by Hugo Vázquez Docampo
Si te mola, ⭐️ al repo y cuéntame qué feature te gustaría ver.
⸻
📄 Licencia
MIT — ú­salo libremente y construye encima.
⸻
¿Listo para hablar con Grooky? 👉 https://siri-gpt.vercel.app/ui.html

