import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const userMessage = req.body.message;

      // Llamada al modelo Starcoder de Hugging Face
      const response = await fetch("https://api-inference.huggingface.co/models/bigcode/starcoder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`, // Si decides usar un token
        },
        body: JSON.stringify({
          inputs: userMessage,
        }),
      });

      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}