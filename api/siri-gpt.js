import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const userMessage = req.body.message;

      // Llamada a la nueva API GPT
      const response = await fetch(`https://free-unoficial-gpt4o-mini-api-g70n.onrender.com/?message=${encodeURIComponent(userMessage)}`);
      const data = await response.json();

      // Enviar la respuesta al cliente
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}