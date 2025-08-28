import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/siri-gpt", async (req, res) => {
  try {
    const userMessage = req.body.message;

    // Llamada a Puter.js (IA gratuita)
    const response = await fetch("https://js.puter.com/v2/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
