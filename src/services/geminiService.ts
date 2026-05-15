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
  try {
    const response = await fetch('/api/analyze-plant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ photoBase64 }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (e) {
    console.error("Failed to analyze image via backend endpoint:", e);
    throw e;
  }
}

