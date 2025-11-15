import { Groq } from "groq-sdk";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Initialize Groq client
    const client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Call Groq LLM for text-only chat
    const response = await client.chat.completions.create({
      model: "llama3-8b-8192", // extremely fast model
      messages: [
        { role: "system", content: "You are a helpful recycling assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
    });

    const message = response.choices[0].message.content;

    res.status(200).json({ response: message });

  } catch (error) {
    console.error("Groq API error:", error);
    res.status(500).json({ error: "Groq API error" });
  }
}
