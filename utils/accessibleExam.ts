/**
 * Utilidades para accesibilidad cognitiva (Dislexia y TDAH).
 * Identifica y resalta instrucciones críticas y palabras clave negativas
 * que los alumnos con TDAH o dislexia suelen omitir por lectura rápida o dispersión.
 */

// Palabras clave en castellano y valenciano que requieren resalte visual
const CRITICAL_KEYWORDS_REGEX = /\b(NO|EXCEPTO|EXCEPTE|EXCEPTUANT|INCORRECTA|INCORRECTO|INCORRECTES|INCORRECTOS|INCORRECTE|FALSA|FALSO|FALSES|FALSOS|FALS|NUNCA|JAMÁS|MAI|VERDADERA|VERDADERO|VERITABLE|VERTADERA|VERTADER|CORRECTA|CORRECTO|CORRECTES|CORRECTOS|CORRECTE|MENOS|MENYS)\b/gi;

export interface TextChunk {
  text: string;
  isCritical: boolean;
  isBoldMarkdown: boolean;
}

/**
 * Descompone el texto de una pregunta en fragmentos para renderizar resaltados
 * tanto de markdown (**negrita**) como de términos críticos para TDAH / Dislexia.
 */
export function parseAccessibleQuestionText(text: string, isAdapted: boolean): TextChunk[] {
  if (!text) return [];

  // Si no es adaptado, solo parseamos el markdown **bold**
  if (!isAdapted) {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { text: part.slice(2, -2), isCritical: false, isBoldMarkdown: true };
      }
      return { text: part, isCritical: false, isBoldMarkdown: false };
    });
  }

  // Si es adaptado: primero dividimos por markdown **bold**
  const boldParts = text.split(/(\*\*.*?\*\*)/);
  const result: TextChunk[] = [];

  for (const part of boldParts) {
    const isBold = part.startsWith('**') && part.endsWith('**');
    const content = isBold ? part.slice(2, -2) : part;

    // Dividimos el contenido buscando términos críticos
    const subParts = content.split(CRITICAL_KEYWORDS_REGEX);
    for (const sub of subParts) {
      if (!sub) continue;
      const isCritical = CRITICAL_KEYWORDS_REGEX.test(sub);
      // Resetear el lastIndex por el flag global
      CRITICAL_KEYWORDS_REGEX.lastIndex = 0;

      result.push({
        text: sub,
        isCritical,
        isBoldMarkdown: isBold
      });
    }
  }

  return result;
}
