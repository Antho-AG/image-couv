import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // This is a fallback for development, but the environment should provide the key.
  console.warn("API_KEY environment variable is not set. The application may not function correctly.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const editImage = async (
  base64Data: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const generatedBase64 = part.inlineData.data;
        const generatedMimeType = part.inlineData.mimeType || 'image/png';
        return `data:${generatedMimeType};base64,${generatedBase64}`;
      }
    }

    throw new Error("No image data found in the Gemini API response.");

  } catch (error) {
    console.error("Error editing image with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to edit image: ${error.message}`);
    }
    throw new Error("An unknown error occurred while editing the image.");
  }
};
