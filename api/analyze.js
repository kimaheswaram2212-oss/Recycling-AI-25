import OpenAI from "openai";
import multiparty from "multiparty";
import fs from "fs";

// Load recycling dataset safely (works on Vercel)
const recyclingData = JSON.parse(
  fs.readFileSync("./recycling_data.json", "utf8")
);

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ reply: "Form parsing error" });
    }

    const userText = fields.text ? fields.text[0] : "";
    const imageFile = files.image ? files.image[0] : null;

    let imageData = null;
    if (imageFile) {
      try {
        imageData = fs.readFileSync(imageFile.path).toString("base64");
      } catch (e) {
        return res.json({ reply: "Failed to read uploaded image file." });
      }
    }

    // Init OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // System prompt with valid categories
    const systemPrompt = `
      You are a recycling expert AI. You classify items into specific waste categories.

      You MUST respond with ONLY a JSON object in this format:

      {
        "predicted_class": "class name",
        "description": "short explanation of what the item is"
      }

      The predicted_class MUST match exactly one of these dataset categories:
      ${Object.keys(recyclingData).join(", ")}
    `;

    // Build messages array
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    if (userText) {
      messages.push({ role: "user", content: userText });
    }

    if (imageData) {
      messages.push({
        role: "user",
        content: [
          { type: "input_text", text: "Here is an image." },
          { type: "input_image", image_url: `data:image/jpeg;base64,${imageData}` }
        ]
      });
    }

    let aiResult;
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages
      });

      aiResult = response.choices[0].message.content;
    } catch (error) {
      return res.status(500).json({ reply: "OpenAI request failed", error });
    }

    // Parse JSON output
    let parsed;
    try {
      parsed = JSON.parse(aiResult);
    } catch (e) {
      return res.json({
        reply: "Error: AI did not return valid JSON.",
        raw: aiResult
      });
    }

    const predicted = parsed.predicted_class;
    const recycleInfo = recyclingData[predicted];

    if (!recycleInfo) {
      return res.json({
        reply: `AI predicted "${predicted}", but it is not in the recycling dataset.`,
        details: parsed
      });
    }

    // Build reply message
    const finalReply = `
Item: ${predicted}
Material: ${recycleInfo.material}
Recyclable: ${recycleInfo.recyclable ? "Yes" : "No"}
Instructions: ${recycleInfo.instructions}

Description: ${parsed.description}
    `.trim();

    return res.json({ reply: finalReply });
  });
}
