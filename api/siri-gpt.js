export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "Falta 'message' en el body" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // o "llama-3.1-8b-instant" si quieres más rápido
        messages: [
          { role: "system", content: "Eres un asistente útil y conciso." },
          { role: "user", content: message }
        ],
        temperature: 0.4
      })
    });

    const data = await response.json();
    const outputText = data.choices?.[0]?.message?.content || "Sin respuesta";
    res.status(200).json({ response: outputText });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
