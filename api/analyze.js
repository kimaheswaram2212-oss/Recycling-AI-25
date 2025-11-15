import Groq from "groq-sdk";
import multiparty from "multiparty";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const config = {
  api: { bodyParser: false }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// recycling_data.json MUST be inside /public on Vercel
const recyclingDataPath = path.join(process.cwd(), "public", "recycling_data.json");
const recyclingData = JSON.parse(fs.readFileSync(recyclingDataPath, "utf8"));

export default async function handler(req, res) {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form error:", err);
      return res.json({ reply: "Form parsing error." });
    }

    const userText = fields.text ? fields.text[0] : "";
    const imageFile = files.image ? files.image[0] : null;

    // We ignore the image, since Groq cannot read images
    if (imageFile) {
      console.log("Image uploaded but Groq cannot process images. Ignoring.");
    }

    if (!userText) {
      return res.json({
        reply: "Groq (free model) cannot analyze images. Please enter text describing the item."
      });
    }

    // Build Groq client
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    const systemPrompt = `
      You are a recycling expert. Reply ONLY with a JSON object:
      {
        "predicted_class": "...",
        "description": "short explanation"
      }
      Allowed classes:
      ${Object.keys(recyclingData).join(", ")}
    `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText }
    ];

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-70b-versatile",
        messages: messages
      });

      const aiText = completion.choices[0].message.content;

      let parsed;
      try {
        parsed = JSON.parse(aiText);
      } catch (e) {
        return res.json({ reply: "AI returned invalid JSON.", raw: aiText });
      }

      const predicted = parsed.predicted_class;
      const info = recyclingData[predicted];

      if (!info) {
        return res.json({
          reply: `AI predicted "${predicted}", but that class does not exist.`,
          details: parsed
        });
      }

      const finalReply = `
Item: ${predicted}
Material: ${info.material}
Recyclable: ${info.recyclable ? "Yes" : "No"}
Instructions: ${info.instructions}

Description: ${parsed.description}
      `.trim();

      res.json({ reply: finalReply });

    } catch (err) {
      console.error("Groq error:", err);
      res.json({ reply: "Groq API error." });
    }
  });
}
