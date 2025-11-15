import OpenAI from "openai";
import multiparty from "multiparty";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const config = {
  api: { bodyParser: false }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MUST be inside public on Vercel
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

    let imageBase64 = null;
    if (imageFile) {
      const fileData = fs.readFileSync(imageFile.path);
      const ext = path.extname(imageFile.originalFilename || "").toLowerCase();
      const mime =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
      imageBase64 = `data:${mime};base64,${fileData.toString("base64")}`;
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = [
      {
        role: "system",
        content: `
          You are a recycling expert. Reply ONLY with a JSON object:
          {
            "predicted_class": "...",
            "description": "short explanation"
          }
          Allowed classes:
          ${Object.keys(recyclingData).join(", ")}
        `
      }
    ];

    if (userText) {
      messages.push({ role: "user", content: userText });
    }

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Analyze this image." },
          { type: "input_image", image_url: imageBase64 }
        ]
      });
    }

    try {
      // IMPORTANT: gpt-4o (NOT gpt-4o-mini)
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages
      });

      const aiText = completion.choices[0].message.content;

      let parsed;
      try {
        parsed = JSON.parse(aiText);
      } catch {
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

      return res.json({ reply: finalReply });
    } catch (err) {
      console.error("OpenAI error:", err);
      return res.json({ reply: "OpenAI API error." });
    }
  });
}

