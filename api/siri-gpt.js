// --- helper: lee el cuerpo crudo pase lo que pase ---
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    try {
      let data = "";
      req.on("data", chunk => { data += chunk; });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    } catch (e) { reject(e); }
  });
}

module.exports = async function handler(req, res) {
  // Cabeceras para que el Atajo NUNCA reciba HTML
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    // GET de salud (abre esta URL en el navegador para comprobar ruta y env)
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        envOk: Boolean(process.env.GROQ_API_KEY),
        now: new Date().toISOString()
      });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST, OPTIONS");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // --- PARSEO ROBUSTO DEL BODY ---
    // 1) intenta leer cuerpo crudo (sirve para text/plain o form-data)
    const rawBody = await getRawBody(req);
    const ct = (req.headers["content-type"] || "").toLowerCase();
    let bodyObj = {};

    if (rawBody && rawBody.length) {
      if (ct.includes("application/json")) {
        try {
          bodyObj = JSON.parse(rawBody);
        } catch (e) {
          return res.status(400).json({ error: "JSON inválido", raw: rawBody.slice(0, 200) });
        }
      } else if (ct.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams(rawBody);
        bodyObj = Object.fromEntries(params);
      } else {
        // text/plain u otro: interpreta TODO el body como el mensaje
        bodyObj = { message: rawBody };
      }
    } else if (req.body) {
      // fallback por si Vercel ya parseó
      bodyObj = typeof req.body === "string" ? { message: req.body } : req.body;
    }

    const { message } = bodyObj || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Falta 'message' (string) en el body",
        tip: "Manda JSON: {\"message\":\"...\"} o text/plain con el texto directamente",
        received: bodyObj
      });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Falta GROQ_API_KEY en variables de entorno" });
    }

    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // o "llama-3.1-8b-instant" para más rapidez
        messages: [
          { role: "system", content: "Eres un asistente útil y conciso." },
          { role: "user", content: message }
        ],
        temperature: 0.4
      })
    });

    // Lee crudo para poder reportar errores no‑JSON
    const groqRaw = await groqResp.text();
    let data;
    try {
      data = JSON.parse(groqRaw);
    } catch {
      return res.status(groqResp.status || 502).json({
        error: "Respuesta no JSON desde Groq",
        details: groqRaw.slice(0, 2000)
      });
    }

    if (!groqResp.ok) {
      return res.status(groqResp.status).json({ error: "Groq API error", details: data });
    }

    const outputText = data?.choices?.[0]?.message?.content?.trim() || "Sin respuesta";
    return res.status(200).json({ response: outputText });

  } catch (err) {
    console.error("❌ Handler error:", err);
    return res.status(500).json({ error: String(err) });
  }
};
