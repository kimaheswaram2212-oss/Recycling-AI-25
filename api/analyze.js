import { Groq } from "groq-sdk";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // Required for FormData uploads
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse FormData manually
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(500).json({ error: "Form parsing failed" });
      }

      const text = fields.text || "";
      const imageFile = files.image;

      // Initialize Groq client
      const client = new Groq({
        apiKey: process.env.GROQ_API_KEY,
      });

      // If image uploaded → convert to Base64
      let imageBase64 = null;
      if (imageFile) {
        const fileData = fs.readFileSync(imageFile.filepath);
        imageBase64 = fileData.toString("base64");
      }

      // Build messages for Groq
      const messages = [
        { role: "system", content: "You are a recycling assistant." }
      ];

      if (text) {
        messages.push({
          role: "user",
          content: text,
        });
      }

      if (imageBase64) {
        messages.push({
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: `data:${imageFile.mimetype};base64,${imageBase64}`
            }
          ]
        });
      }

      // Send to Groq
      const groqResponse = await client.chat.completions.create({
        model: "llama-3.2-11b-vision-preview",
        messages,
      });

      const reply = groqResponse.choices[0].message.content;

      return res.status(200).json({ reply });
    });

  } catch (error) {
    console.error("Groq API Error:", error);
    return res.status(500).json({ error: "Groq API failed" });
  }
}

