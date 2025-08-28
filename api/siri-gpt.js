module.exports = async function handler(req, res) {
  // Cabeceras comunes
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    // GET de salud (útil para abrir en el navegador)
    if (req.method === "GET") {
      const envOk = Boolean(process.env.GROQ_API_KEY);
      return res.status(200).json({
        ok: true,
        envOk,
        now: new Date().toISOString()
      });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST, OPTIONS");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Body puede venir como objeto o como string
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { message } = body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Falta 'message' (string) en el body" });
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
        model: "llama-3.3-70b-versatile", // o "llama-3.1-8b-instant" (más rápido/ligero)
        messages: [
          { role: "system", content: "Eres un asistente útil y conciso." },
          { role: "user", content: message }
        ],
        temperature: 0.4
      })
    });

    const raw = await groqResp.text(); // leemos crudo para no romper si no es JSON
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      // Si Groq devolvió algo no-JSON, reenvía como error JSON legible por el Atajo
      return res.status(groqResp.status || 502).json({
        error: "Respuesta no JSON desde Groq",
        details: raw.slice(0, 2000)
      });
    }

    if (!groqResp.ok) {
      return res.status(groqResp.status).json({
        error: "Groq API error",
        details: data
      });
    }

    const outputText = data?.choices?.[0]?.message?.content?.trim() || "Sin respuesta";
    return res.status(200).json({ response: outputText });

  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};