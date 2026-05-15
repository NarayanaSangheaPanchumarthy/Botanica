import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  app.post("/api/analyze-plant", async (req, res) => {
    try {
      const { photoBase64 } = req.body;
      if (!photoBase64) {
        return res.status(400).json({ error: "No photo provided" });
      }

      // Check for either GEMINI_API_KEY, GEMINI_API_KEY1, or Botanica
      const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1 || process.env.Botanica;
      if (!apiKey) {
        return res.status(500).json({ error: "API key is not configured on the server" });
      }

      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-2.5-flash";
      const base64Data = photoBase64.includes(",") ? photoBase64.split(",")[1] : photoBase64;

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              text: `Analyze this plant photo and estimate its morphological dimensions in centimeters (cm) for length/width and millimeters (mm) for thickness. 
              Provide estimates for:
              - Sepal Length (cm)
              - Sepal Width (cm)
              - Petal Length (cm)
              - Petal Width (cm)
              - Leaf Length (cm)
              - Leaf Width (cm)
              - Leaf Thickness (mm)
              
              Only provide values for parts that are clearly visible. Return as JSON.`
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data.trim()
              }
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sepalLength: { type: Type.NUMBER, description: "Estimated sepal length in cm" },
              sepalWidth: { type: Type.NUMBER, description: "Estimated sepal width in cm" },
              petalLength: { type: Type.NUMBER, description: "Estimated petal length in cm" },
              petalWidth: { type: Type.NUMBER, description: "Estimated petal width in cm" },
              leafLength: { type: Type.NUMBER, description: "Estimated leaf length in cm" },
              leafWidth: { type: Type.NUMBER, description: "Estimated leaf width in cm" },
              leafThickness: { type: Type.NUMBER, description: "Estimated leaf thickness in mm" },
            }
          }
        }
      });

      const parsedResponse = JSON.parse(response.text || "{}");
      res.json(parsedResponse);
    } catch (error: any) {
      console.error("Error analyzing plant:", error);
      res.status(500).json({ error: error.message || "Failed to analyze image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
