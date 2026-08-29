import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = process.env.PORT || 3001;

if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "Midnight Feast Gemini AI", model: "gemini-3.5-flash" });
});

app.post("/recipe-query", async (req, res) => {
  try {
    const { question, inventory = [] } = req.body;
    if (!question?.trim()) return res.status(400).json({ error: "question is required" });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents:
        `You are Midnight Feast, a practical cooking assistant.\n\n` +
        `Current fridge inventory:\n${JSON.stringify(inventory, null, 2)}\n\n` +
        `User question: ${question}\n\n` +
        `Prefer dishes using existing inventory. Clearly identify missing ingredients. ` +
        `Give practical quantities, steps, and useful heat or temperature guidance where relevant.`
    });

    res.json({ answer: response.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not answer recipe question", detail: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/substitute", async (req, res) => {
  try {
    const { recipeName = "", missingIngredient = "", inventory = [] } = req.body;
    if (!missingIngredient.trim()) return res.status(400).json({ error: "missingIngredient is required" });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents:
        `You are Midnight Feast, a careful cooking substitution assistant.\n\n` +
        `Recipe: ${recipeName || "Not specified"}\n` +
        `Missing ingredient: ${missingIngredient}\n` +
        `Current inventory:\n${JSON.stringify(inventory, null, 2)}\n\n` +
        `First recommend a suitable substitute already in inventory. If none is suitable, give up to 3 practical alternatives. ` +
        `For each, explain how much to use and how taste, texture, or cooking may change.`
    });

    res.json({ answer: response.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not suggest a substitute", detail: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/scan-grocery", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "imageBase64 is required" });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType,
            data: imageBase64
          }
        },
        {
          text:
            "You are the grocery scanner for Midnight Feast. Look only at grocery or food items visibly present in the image. " +
            "Identify separate grocery items, estimate quantity conservatively, choose a sensible unit, and assign one allowed category. " +
            "Do not invent hidden items. If quantity is uncertain, lower confidence. " +
            "Allowed categories: Vegetable, Fruit, Dairy, Eggs, Meat, Fish, Grains, Bakery, Condiments, Other."
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string", enum: ["pcs", "kg", "g", "L", "ml", "pack", "bunch", "Other"] },
                  category: { type: "string", enum: ["Vegetable", "Fruit", "Dairy", "Eggs", "Meat", "Fish", "Grains", "Bakery", "Condiments", "Other"] },
                  confidence: { type: "number", minimum: 0, maximum: 1 }
                },
                required: ["name", "quantity", "unit", "category", "confidence"]
              }
            }
          },
          required: ["items"]
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not scan groceries", detail: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.listen(port, () => {
  console.log(`Midnight Feast Gemini backend running on http://localhost:${port}`);
});
