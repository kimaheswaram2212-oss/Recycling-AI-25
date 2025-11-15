import OpenAI from "openai";
import multiparty from "multiparty";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const config = {
  api: { bodyParser: false }
};

// Fix recycling_data.json path on Vercel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const recyclingDataPath = path.join(__dirname, "..", "recycling_data.json");
const recyclingData = JSON.parse(fs.readFileSync(recyclingDataPath, "utf8"));

export default async function handler(req, res) {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    console.log("FIELDS:", fields);
    console.log("FILES:", files);
    if (err) return res.json({ reply: "Form parsing error" });

    const userText = fields.text ? fields.text[0] : "";
    const imageFile = files.image ? files.image[0] : null;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Read image (if provided)
    let imageData = null;
    if (imageFile) {
      imageData = fs.readFileSync(imageFile.path).toString("base64");
    }

    // System prompt
    const systemPrompt = `
    You are a recycling expert AI. Output ONLY a JSON object:

    {
      "predicted_class": "...",
      "description": "Short explanation"
    }

    Use ONLY one of these classes:
    ${Object.keys(recyclingData).join(", ")}
    `;

    // Build OpenAI input
    let messages = [
      { role: "system", content: systemPrompt }
    ];

    if (userText) {
      messages.push({ role: "user", content: userText });
    }

    if (imageData) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Here is an image." },
          { type: "input_image", image_url: `data:image/jpeg;base64,${imageData}` }
        ]
      });
    }

    // NEW API FORMAT
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: messages
    });

    const aiText = response.output[0].content[0].text;
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
        reply: `AI predicted: "${predicted}" but that class does not exist.`,
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

