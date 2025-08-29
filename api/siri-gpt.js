// Acepta:
//  - { message: "..." }  (turno único)
//  - { messages: [{role:"system"|"user"|"assistant", content:"..."}], model?, temperature? }  (chat)

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  // Cabeceras para JSON y CORS
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, now: new Date().toISOString() });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST, OPTIONS");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const raw = await getRawBody(req);
    const ct = (req.headers["content-type"] || "").toLowerCase();
    let body = {};
    if (ct.includes("application/json")) {
      try { body = JSON.parse(raw || "{}"); }
      catch { return res.status(400).json({ error: "JSON inválido", raw: raw?.slice(0,200) }); }
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(raw);
      body = Object.fromEntries(params);
    } else {
      // text/plain u otros: interpretar como message directo
      body = { message: raw };
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Falta GROQ_API_KEY" });

    // Soporte de ambos modos
    let messages = body.messages;
    const single = body.message;
    const model = body.model || "llama-3.3-70b-versatile"; // puedes cambiar a 8b si quieres más cupo
    const temperature = typeof body.temperature === "number" ? body.temperature : 0.4;

    if (!messages && !single) {
      return res.status(400).json({ error: "Falta 'message' o 'messages[]' en el body" });
    }
    if (!messages && single) {
      messages = [
        { role: "system", content: "Eres un asistente útil y conciso." },
        { role: "user", content: String(single) }
      ];
    }

    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false // más adelante podemos habilitar streaming SSE
      })
    });

    const groqText = await groqResp.text();
    let data;
    try { data = JSON.parse(groqText); }
    catch {
      return res.status(groqResp.status || 502).json({ error: "Respuesta no JSON desde Groq", details: groqText.slice(0, 2000) });
    }

    if (!groqResp.ok) {
      return res.status(groqResp.status).json({ error: "Groq API error", details: data });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({
      response: reply,
      model: data?.model,
      usage: data?.usage || null
    });

  } catch (err) {
    console.error("❌ siri-gpt error:", err);
    return res.status(500).json({ error: String(err) });
  }
};