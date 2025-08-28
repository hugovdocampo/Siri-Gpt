import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const userMessage = req.body.message;

      const response = await fetch(
        "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`
          },
          body: JSON.stringify({ inputs: userMessage })
        }
      );

      const data = await response.json();
      const outputText = data[0]?.generated_text || "No se recibió respuesta";

      res.status(200).json({ response: outputText });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}