import OpenAI from "openai";
import multiparty from "multiparty";
import fs from "fs";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    const userText = fields.text ? fields.text[0] : "";
    const imageFile = files.image ? files.image[0] : null;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let imageData = null;
    if (imageFile) {
      imageData = fs.readFileSync(imageFile.path).toString("base64");
    }

    const prompt = `
      You are a recycling expert AI.
      The user may provide text, an image, or both.
      Your job:
      1. Identify the object.
      2. Predict materials (plastic, paper, aluminum, etc.)
      3. Say if it is recyclable.
      4. Give disposal instructions.
      5. Use the dataset rules provided.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        ...(userText ? [{ role: "user", content: userText }] : []),
        ...(imageData ? [{
          role: "user",
          content: [
            { type: "input_text", text: "Here is an image." },
            { type: "input_image", image_url: `data:image/jpeg;base64,${imageData}` }
          ]
        }] : [])
      ]
    });

    res.json({ reply: response.choices[0].message.content });
  });
}
