// Serverless function para Vercel (CommonJS).
// - Acepta { message } o { messages[] }.
// - Sanitiza mensajes: solo {role, content}.
// - Devuelve siempre JSON (errores incluidos), nunca HTML.

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB límite de body
const MAX_MSGS = 64;                     // máx. nº de mensajes en el historial
const MAX_CHARS = 8000;                  // máx. caracteres por content
const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);

function getRawBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Body demasiado grande"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sanitizeText(s) {
  if (typeof s !== "string") s = String(s ?? "");
  // Elimina controles excepto tab/newline/carriage-return
  s = s.replace(/[^\x09\x0A\x0D\x20-\uFFFF]/g, "");
  s = s.trim();
  if (s.length > MAX_CHARS) s = s.slice(0, MAX_CHARS);
  return s;
}

function sanitizeMessages(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    const role = sanitizeText(x?.role || "");
    const content = sanitizeText(x?.content || "");
    if (!ALLOWED_ROLES.has(role)) continue;
    if (!content) continue;
    out.push({ role, content });
    if (out.length >= MAX_MSGS) break;
  }
  return out;
}

function buildMessagesFromBody(body) {
  // Prioridad a messages[] si viene.
  if (Array.isArray(body?.messages)) {
    const msgs = sanitizeMessages(body.messages);
    if (msgs.length) return msgs;
  }
  // Si no, usa message (string) como primer turno del usuario
  const single = sanitizeText(body?.message || "");
  if (single) {
    return [
      { role: "system", content: "Eres un asistente útil y conciso." },
      { role: "user", content: single }
    ];
  }
  return [];
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function setCommonHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

async function parseBody(req) {
  // Devuelve objeto body y content-type sencillo
  const ct = (req.headers["content-type"] || "").toLowerCase();
  const raw = await getRawBody(req);
  if (!raw) return [{}, ct];

  if (ct.includes("application/json")) {
    try {
      return [JSON.parse(raw), ct];
    } catch (e) {
      throw new Error("JSON inválido");
    }
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    return [Object.fromEntries(params), ct];
  }
  // text/plain u otros → tratar como message
  return [{ message: raw }, ct];
}

module.exports = async function handler(req, res) {
  setCommonHeaders(res);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  // GET salud
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      envOk: Boolean(process.env.GROQ_API_KEY),
      now: new Date().toISOString()
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return json(res, 500, { error: "Falta GROQ_API_KEY" });

    const [body /* , ct */] = await parseBody(req);

    // Construir mensajes
    const messages = buildMessagesFromBody(body);
    if (!messages.length) {
      return json(res, 400, {
        error: "Falta 'message' o 'messages[]' con contenido válido"
      });
    }

    // Opcionales
    const model =
      typeof body?.model === "string" && body.model.trim()
        ? body.model.trim()
        : "llama-3.3-70b-versatile";

    let temperature = 0.4;
    if (typeof body?.temperature === "number") {
      // clamp
      temperature = Math.max(0, Math.min(2, body.temperature));
    }

    // LLAMADA a Groq (OpenAI-compatible)
    const groqResp = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          model,
          messages,       // ya saneados
          temperature,
          stream: false
        })
      }
    );

    const groqText = await groqResp.text();

    let data;
    try {
      data = JSON.parse(groqText);
    } catch (e) {
      // Si no es JSON, reenviamos como error legible en JSON
      return json(res, groqResp.status || 502, {
        error: "Respuesta no JSON desde Groq",
        details: groqText.slice(0, 2000)
      });
    }

    if (!groqResp.ok) {
      // Pasar el error de Groq al cliente
      return json(res, groqResp.status, {
        error: "Groq API error",
        details: data
      });
    }

    const reply = (data?.choices?.[0]?.message?.content || "").trim();

    return json(res, 200, {
      response: reply,
      model: data?.model || model,
      usage: data?.usage || null
    });
  } catch (err) {
    return json(res, 500, { error: String(err) });
  }
};
