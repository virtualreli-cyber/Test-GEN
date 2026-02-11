import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const cleanResponse = (text) => {
  if (!text) return "[]";
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return cleaned;
};

export const handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { text } = JSON.parse(event.body);

    if (!text || !text.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Text is required' })
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: `Extract multiple choice questions from the following text. 
      The text contains questions and their answers. 
      Do not change the wording of the questions or answers. 
      Return a clean JSON structure. 
      Input text:
      ${text}`,
      config: {
        systemInstruction: "You are a helpful assistant that structures raw exam text into JSON. Identify the question text and the 4 options. Do not alter the content.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The question text"
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "The list of 4 possible answers"
              }
            },
            required: ["text", "options"]
          }
        }
      }
    });

    const parsedData = JSON.parse(cleanResponse(response.text));

    // Add IDs to the questions
    const questions = parsedData.map((q, index) => ({
      id: `q-${index}-${Date.now()}`,
      text: q.text,
      options: q.options
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(questions)
    };

  } catch (error) {
    console.error('Error parsing questions:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process text with AI' })
    };
  }
};
