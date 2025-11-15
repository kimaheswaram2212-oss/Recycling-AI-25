import OpenAI from "openai";
import multiparty from "multiparty";
import fs from "fs";
import recyclingData from "../../recycling_data.json";   // <-- NEW: load your JSON file

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    const userText = fields.text ? fields.text[0] : "";
    const imageFile = files.image ? files.image[0] : null;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    let imageData = null;
    if (imageFile) {
      imageData = fs.readFileSync(imageFile.path).toString("base64");
    }

    const systemPrompt = `
      You are a recycling expert AI. You classify items into specific waste categories.
      You MUST respond with a JSON object in this format exactly:

      {
        "predicted_class": "...",
        "description": "Short explanation of what the item is"
      }

      The predicted_class MUST match one of these dataset classes exactly:
      ${Object.keys(recyclingData).join(", ")}
    `;

    // Send request to OpenAI
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });

    let aiResult = response.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(aiResult);
    } catch (err) {
      // If OpenAI didn't return JSON, fall back safely
      return res.json({
        reply: "Error: Could not parse AI result.",
        raw: aiResult
      });
    }

    const predicted = parsed.predicted_class;
    const recycleInfo = recyclingData[predicted];

    if (!recycleInfo) {
      return res.json({
        reply: `I identified this item as "${predicted}", but it is not in the recycling dataset.`,
        details: parsed
      });
    }

    // Build final reply
    const finalReply = `
Item: ${predicted}
Material: ${recycleInfo.material}
Recyclable: ${recycleInfo.recyclable ? "Yes" : "No"}
Instructions: ${recycleInfo.instructions}

Description: ${parsed.description}
    `;

    res.json({ reply: finalReply.trim() });
  });
}
