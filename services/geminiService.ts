import { Question, ExamHeader } from "../types";

// Netlify Functions base URL - works in both dev and production
const API_BASE = '/.netlify/functions';

export const parseQuestionsFromText = async (text: string): Promise<Question[]> => {
  if (!text.trim()) return [];

  try {
    const response = await fetch(`${API_BASE}/parse-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to parse questions');
    }

    return await response.json();

  } catch (error) {
    console.error("Error parsing questions with Gemini:", error);
    throw new Error("Failed to process text with AI.");
  }
};

export const adaptQuestionsForAccessibility = async (questions: Question[]): Promise<Question[]> => {
  if (questions.length === 0) return [];

  try {
    const response = await fetch(`${API_BASE}/adapt-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to adapt questions');
    }

    return await response.json();

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
    const response = await fetch(`${API_BASE}/translate-exam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions, header })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to translate');
    }

    return await response.json();

  } catch (error) {
    console.error("Error translating exam:", error);
    throw new Error("No se pudo traducir al Valenciano. Inténtalo de nuevo.");
  }
};