import OpenAI from "openai";
import multiparty from "multiparty";
import fs from "fs";
import path from "path";

export const config = {
  api: { bodyParser: false }
};

// Correct path to recycling_data.json
const recyclingData = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "recycling_data.json"), "utf8")
);

export default async function handler(req, res) {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ reply: "Form parsing error" });
    }

    const userText = fields.text ? fields.text[0] : "";
    const imageFile = files.image ? files.image[0] : null;

    // Init OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    let imageBase64 = null;
    if (imageFile) {
      imageBase64 = fs.readFileSync(imageFile.path).toString("base64");
    }

    // Build system prompt
    const classes = Object.keys(recyclingData).join(", ");
    const systemPrompt = `
You are a recycling classification AI.
Return ONLY valid JSON:

{
  "predicted_class": "one of: ${classes}",
  "description": "short explanation"
}
`;

    // Build messages using new API format
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    if (userText) {
      messages.push({
        role: "user",
        content: [{ type: "text", text: userText }]
      });
    }

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Here is an image." },
          { type: "image", image: imageBase64 }
        ]
      });
    }

    try {
      const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        messages
      });

      const output = response.output[0].content[0].text;

      let parsed;
      try {
        parsed = JSON.parse(output);
      } catch (e) {
        return res.json({
          reply: "AI returned invalid JSON.",
          raw: output
        });
      }

      const predicted = parsed.predicted_class;
      const info = recyclingData[predicted];

      if (!info) {
        return res.json({
          reply: `Identified "${predicted}" but it is not in the recycling dataset.`,
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
      console.error(err);
      return res.status(500).json({ reply: "Server error", details: err.message });
    }
  });
}
