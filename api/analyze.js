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

const recyclingDataPath = path.join(__dirname, "..", "recycling_data.json");
const recyclingData = JSON.parse(fs.readFileSync(recyclingDataPath, "utf8"));

export default function handler(req, res) {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.json({ reply: "Form parsing error" });

    const userText = fields.text ? fields.text[0] : "";
    const imageFile = files.image ? files.image[0] : null;

    // Read image file (if any)
    let imageBase64 = null;
    if (imageFile) {
      const imgBuffer = fs.readFileSync(imageFile.path);
      imageBase64 = imgBuffer.toString("base64");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Build input for Responses API
    const input = [];

    // System instructions as plain text
    input.push(`
You are a recycling expert AI. Output ONLY a JSON object:

{
  "predicted_class": "...",
  "description": "Short explanation"
}

Classes you can choose from:
${Object.keys(recyclingData).join(", ")}
    `);

    if (userText) input.push(userText);

    if (imageBase64) {
      input.push({
        image: {
          base64: imageBase64
        }
      });
    }

    // Call OpenAI Responses API
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input
    });

    const aiText = response.output_text;

    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch (e) {
      return res.json({ reply: "AI returned invalid JSON.", raw: aiText });
    }

    const predicted = parsed.predicted_class;
    const recycleInfo = recyclingData[predicted];

    if (!recycleInfo) {
      return res.json({
        reply: `AI predicted "${predicted}", but that class does not exist.`,
        details: parsed
      });
    }

    const finalReply = `
Item: ${predicted}
Material: ${recycleInfo.material}
Recyclable: ${recycleInfo.recyclable ? "Yes" : "No"}
Instructions: ${recycleInfo.instructions}

Description: ${parsed.description}
    `.trim();

    res.json({ reply: finalReply });
  });
}


