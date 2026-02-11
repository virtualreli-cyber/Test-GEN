import { GoogleGenAI, Type } from "@google/genai";
import { Question, ExamHeader } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper para limpiar respuestas que contienen bloques de código markdown
const cleanResponse = (text: string | undefined): string => {
  if (!text) return "[]";
  // Eliminar bloques ```json y ``` al inicio y final
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return cleaned;
};

export const parseQuestionsFromText = async (text: string): Promise<Question[]> => {
  if (!text.trim()) return [];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
    return parsedData.map((q: any, index: number) => ({
      id: `q-${index}-${Date.now()}`,
      text: q.text,
      options: q.options
    }));

  } catch (error) {
    console.error("Error parsing questions with Gemini:", error);
    throw new Error("Failed to process text with AI.");
  }
};

export const adaptQuestionsForAccessibility = async (questions: Question[]): Promise<Question[]> => {
  if (questions.length === 0) return [];

  try {
    const questionsJSON = JSON.stringify(questions.map(q => ({ text: q.text, options: q.options })));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

    return adaptedData.map((q: any, index: number) => ({
      id: questions[index]?.id ? `${questions[index].id}-adapted` : `adapted-${index}-${Date.now()}`,
      text: q.text,
      options: q.options
    }));

  } catch (error) {
    console.error("Error adapting questions:", error);
    throw new Error("No se pudo generar la versión adaptada.");
  }
};

export const translateExamContent = async (
  questions: Question[],
  header: ExamHeader
): Promise<{ questions: Question[], header: ExamHeader }> => {
  if (questions.length === 0) return { questions: [], header };

  try {
    const payload = {
      header: header,
      questions: questions.map(q => ({ id: q.id, text: q.text, options: q.options }))
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

    // Usamos cleanResponse para evitar errores de parseo si la IA devuelve markdown
    const translatedData = JSON.parse(cleanResponse(response.text));

    // Verificación básica
    if (!translatedData.questions || !translatedData.header) {
      throw new Error("Invalid translation response structure");
    }

    return {
      questions: translatedData.questions,
      header: translatedData.header
    };

  } catch (error) {
    console.error("Error translating exam:", error);
    throw new Error("No se pudo traducir al Valenciano. Inténtalo de nuevo.");
  }
};