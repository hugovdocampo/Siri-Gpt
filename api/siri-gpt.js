import fetch from "node-fetch";

export default async function handler(req, res) {
  console.log("📌 Handler ejecutado");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Falta 'message' en el body" });
    }

    console.log("Mensaje recibido:", message);

    // 🔹 Endpoint TGI fijo en el código
    const TGI_ENDPOINT = "https://vlzz10eq3fol3429.us-east-1.aws.endpoints.huggingface.cloud/v1/";
    const API_KEY = process.env.HUGGINGFACE_API_KEY; 

    const response = await fetch(`${TGI_ENDPOINT}chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "tgi",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: message }
        ]
      })
    });

    console.log("Status de la respuesta:", response.status);

    const data = await response.json();
    console.log("Respuesta cruda:", data);

    const outputText = data.choices?.[0]?.message?.content || "No se recibió respuesta";
    res.status(200).json({ response: outputText });

  } catch (error) {
    console.error("❌ Error general:", error);
    res.status(500).json({ error: error.message });
  }
}