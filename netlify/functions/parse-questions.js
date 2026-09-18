import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const cleanResponse = (text) => {
  if (!text) return "[]";
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return cleaned;
};

const cleanQuestionText = (text) => {
  if (!text) return "";
  return text
    .replace(
      /^\s*(?:(?:pregunta|qüestió|questio|p|question|q)\s*\.?\s*\d+\s*(?:[-–—]|[\.\)\-:])*|(?:\(?\d{1,3}\)?(?:[\.\-:]+|[-–—])+\s+|\(?\d{1,3}\)\s*))\s*/i,
      ""
    )
    .trim();
};

const cleanOptionText = (text) => {
  if (!text) return "";
  return text
    .replace(
      /^\s*(?:(?:\(?[a-zA-Z]\)?[\.\)\-:]+|\([a-zA-Z0-9]\)|\d{1,2}\))\s*|(?:\(?\d{1,2}\)?(?:[\.\-:]+|[-–—])+|[-*•])\s+)\s*/,
      ""
    )
    .trim();
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
      Extract only the clean text of questions and answers. Do NOT include question numbers (like '1.', 'Pregunta 1') or option letters/bullets (like 'a)', 'A.', '-') in the text or options.
      Return a clean JSON structure. 
      Input text:
      ${text}`,
      config: {
        systemInstruction: "You are a helpful assistant that structures raw exam text into JSON. Identify the question text and options without any leading numbering or lettering. Do not alter the actual content.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The question text without any leading question number"
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "The list of possible answers without any leading letters or bullets"
              }
            },
            required: ["text", "options"]
          }
        }
      }
    });

    const parsedData = JSON.parse(cleanResponse(response.text));

    // Add IDs to the questions and sanitize
    const questions = parsedData.map((q, index) => ({
      id: `q-${index}-${Date.now()}`,
      text: cleanQuestionText(q.text),
      options: (q.options || []).map(cleanOptionText)
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
