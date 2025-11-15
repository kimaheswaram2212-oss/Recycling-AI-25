import Groq from "groq-sdk";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",  // ✅ Valid model
      messages: [
        { role: "system", content: "You are a helpful recycling assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });

    const message = response.choices[0].message.content;
    res.status(200).json({ response: message });
  } catch (err) {
    console.error("Groq API Error:", err);
    res.status(500).json({ error: err.message });
  }
}
