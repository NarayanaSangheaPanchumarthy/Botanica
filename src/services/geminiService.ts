import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface PlantDimensions {
  sepalLength?: number;
  sepalWidth?: number;
  petalLength?: number;
  petalWidth?: number;
  leafLength?: number;
  leafWidth?: number;
  leafThickness?: number;
}

export async function analyzePlantDimensions(photoBase64: string): Promise<PlantDimensions> {
  const model = "gemini-3-flash-preview";
  
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

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse Gemini response:", e);
    return {};
  }
}
