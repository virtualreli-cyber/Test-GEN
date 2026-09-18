/**
 * Utilidades para limpiar numeraciones o letras previas en preguntas y opciones.
 * Permite separar de forma limpia la numeración correlativa del contenido redactado.
 */

export function cleanQuestionText(text: string): string {
  if (!text) return '';
  return text
    .replace(
      /^\s*(?:(?:pregunta|qüestió|questio|p|question|q)\s*\.?\s*\d+\s*(?:[-–—]|[\.\)\-:])*|(?:\(?\d{1,3}\)?(?:[\.\-:]+|[-–—])+\s+|\(?\d{1,3}\)\s*))\s*/i,
      ''
    )
    .trim();
}

export function cleanOptionText(text: string): string {
  if (!text) return '';
  return text
    .replace(
      /^\s*(?:(?:\(?[a-zA-Z]\)?[\.\)\-:]+|\([a-zA-Z0-9]\)|\d{1,2}\))\s*|(?:\(?\d{1,2}\)?(?:[\.\-:]+|[-–—])+|[-*•])\s+)\s*/,
      ''
    )
    .trim();
}
