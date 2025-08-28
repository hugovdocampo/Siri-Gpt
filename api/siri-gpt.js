import fetch from "node-fetch";

export default async function handler(req, res) {
  console.log("📌 Handler ejecutado"); // Siempre se verá si la función se llama

  if (req.method !== "POST") {
    console.error("❌ Método no permitido:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Validar body
    if (!req.body || !req.body.message) {
      console.error("❌ No se recibió 'message' en el body:", req.body);
      return res.status(400).json({ error: "Falta 'message' en el body" });
    }

    const userMessage = req.body.message;
    console.log("Mensaje recibido:", userMessage);

    // Revisar que el token exista
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.error("❌ No se encontró HUGGINGFACE_API_KEY");
      return res.status(500).json({ error: "Token de Hugging Face no configurado" });
    }
    console.log("Token presente: Sí");

    // Modelo fijo
    const modelURL = "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct";

    // Petición a Hugging Face
    const response = await fetch(modelURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`
      },
      body: JSON.stringify({ inputs: userMessage })
    });

    console.log("Status de la respuesta:", response.status);

    const text = await response.text();
    console.log("Contenido crudo de la respuesta:", text);

    // Parsear JSON
    try {
      const data = JSON.parse(text);
      const outputText = data[0]?.generated_text || "No se recibió respuesta";
      res.status(200).json({ response: outputText });
    } catch (jsonError) {
      console.error("❌ Error parseando JSON:", jsonError.message);
      res.status(500).json({ error: "La API no devolvió JSON válido", raw: text });
    }

  } catch (error) {
    console.error("❌ Error general del proxy:", error.message);
    res.status(500).json({ error: error.message });
  }
}