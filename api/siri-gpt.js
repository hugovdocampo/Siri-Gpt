import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const userMessage = req.body.message;
      console.log("Mensaje recibido:", userMessage);

      // Log del token (sin mostrarlo completo por seguridad)
      console.log("Token presente:", process.env.HUGGINGFACE_API_KEY ? "Sí" : "No");

      const response = await fetch(
        "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct", // modelo fijo
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`
          },
          body: JSON.stringify({ inputs: userMessage })
        }
      );

      console.log("Status de la respuesta:", response.status);

      const text = await response.text();
      console.log("Contenido de la respuesta:", text);

      try {
        const data = JSON.parse(text);
        const outputText = data[0]?.generated_text || "No se recibió respuesta";
        res.status(200).json({ response: outputText });
      } catch (jsonError) {
        console.error("Error parseando JSON:", jsonError.message);
        res.status(500).json({ error: "La API no devolvió JSON válido", raw: text });
      }

    } catch (error) {
      console.error("Error general del proxy:", error.message);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}