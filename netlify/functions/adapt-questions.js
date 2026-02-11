import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const cleanResponse = (text) => {
  if (!text) return "[]";
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return cleaned;
};

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

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
    const { questions } = JSON.parse(event.body);

    if (!questions || questions.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Questions are required' })
      };
    }

    const questionsJSON = JSON.stringify(questions.map(q => ({ text: q.text, options: q.options })));

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: `Adapt these exam questions for students with dyslexia or special reading needs (Easy Read format).
      Rules:
      1. Simplify sentence structure. Use active voice.
      2. Avoid double negatives.
      3. Bold key terms in the question using markdown **bold**.
      4. Keep the options simple and direct.
      5. Do NOT change the correct answer logic, just the phrasing.
      
      Questions JSON:
      ${questionsJSON}`,
      config: {
        systemInstruction: "You are an expert in accessible education and Easy Read formatting.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["text", "options"]
          }
        }
      }
    });

    const adaptedData = JSON.parse(cleanResponse(response.text));

    const adaptedQuestions = adaptedData.map((q, index) => ({
      id: questions[index]?.id ? `${questions[index].id}-adapted` : `adapted-${index}-${Date.now()}`,
      text: q.text,
      options: q.options
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(adaptedQuestions)
    };

  } catch (error) {
    console.error('Error adapting questions:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to generate adapted version' })
    };
  }
};
