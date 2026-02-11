import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const cleanResponse = (text) => {
  if (!text) return "{}";
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
    const { questions, header } = JSON.parse(event.body);

    if (!questions || questions.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Questions and header are required' })
      };
    }

    const payload = {
      header: header,
      questions: questions.map(q => ({ id: q.id, text: q.text, options: q.options }))
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: `Translate the following exam content from Spanish to Valencian (Valencià).
      Use the official normative (normativa oficial valenciana).
      
      Rules:
      1. Translate the Title, Subtitle, Department, NameLabel, and CourseLabel in the header.
      2. Translate all questions and options.
      3. CRITICAL: Do NOT change the order of questions.
      4. CRITICAL: Do NOT change the order of options within a question.
      5. Keep the IDs exactly as they are.
      
      Input JSON:
      ${JSON.stringify(payload)}`,
      config: {
        systemInstruction: "You are a professional translator specializing in academic Valencian.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            header: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                department: { type: Type.STRING },
                courseLabel: { type: Type.STRING },
                nameLabel: { type: Type.STRING },
              }
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            }
          }
        }
      }
    });

    const translatedData = JSON.parse(cleanResponse(response.text));

    if (!translatedData.questions || !translatedData.header) {
      throw new Error("Invalid translation response structure");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        questions: translatedData.questions,
        header: translatedData.header
      })
    };

  } catch (error) {
    console.error('Error translating exam:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to translate to Valencian' })
    };
  }
};
