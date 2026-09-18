import { ExamHeader } from '../types';

/**
 * Algoritmo heurístico para detectar si un texto está en valenciano/catalán o en castellano.
 * No utiliza ninguna IA ni servicio externo; analiza reglas morfológicas, caracteres
 * exclusivos y frecuencia de palabras clave funcionales.
 */
export function detectLanguage(text: string): 'es' | 'va' {
  if (!text || text.trim().length === 0) return 'es';

  const lower = text.toLowerCase();

  // Patrones y caracteres que son exclusivos o fuertemente indicativos del valenciano/catalán
  const vaSpecial = [
    /l·l/g,                                        // ela geminada: novel·la, col·lecció
    /[ç]/g,                                        // ce trencada: lliçó, plaça, feliç
    /\b[dmlstn]['’]/g,                             // apóstrofos al inicio: d'acord, l'home, s'ha, m'agrada
    /['’][dmlstn]\b/g,                             // apóstrofos al final: 'l, 'ns
    /-(?:se|te|vos|nos|li|lo|la|los|les|hi|ho|ne)\b/g, // pronombres clíticos con guion: fer-se, deixar-ho
    /[àèò]/g,                                      // acentos graves (inexistentes en castellano)
    /[ï]/g,                                        // diéresis en la i (veí, suïcida)
  ];

  let vaScore = 0;
  for (const regex of vaSpecial) {
    const matches = lower.match(regex);
    if (matches) vaScore += matches.length * 3;
  }

  // Tokenización de palabras
  const words = lower.match(/[\p{L}·]+/gu) || [];

  // Palabras funcionales de alta frecuencia en valenciano
  const VA_WORDS = new Set([
    'amb', 'dels', 'deles', 'als', 'ales', 'pels', 'peles', 'però', 'doncs', 'també', 'tampoc',
    'sense', 'fins', 'mentre', 'durant', 'sobre', 'sota', 'entre', 'contra', 'segons',
    'aquest', 'aquesta', 'aquests', 'aquestes', 'aquell', 'aquella', 'aquells', 'aquelles',
    'meu', 'meua', 'teu', 'teua', 'seu', 'seua', 'nostre', 'nostra', 'vostre', 'vostra',
    'quin', 'quina', 'quins', 'quines', 'què', 'on', 'quan', 'com', 'quant', 'quanta',
    'res', 'ningú', 'hom', 'tothom', 'qualsevol',
    'és', 'són', 'era', 'eren', 'serà', 'seran', 'siga', 'ha', 'han', 'havia',
    'va', 'van', 'tenir', 'té', 'tenen', 'tenia', 'fer', 'fa', 'fan', 'feia',
    'diu', 'diuen', 'veu', 'veuen', 'veure', 'creure', 'sap', 'saben',
    'pregunta', 'preguntes', 'qüestió', 'qüestions', 'resposta', 'respostes',
    'correcta', 'incorrecta', 'vertadera', 'veritable', 'falsa', 'següent', 'següents',
    'assenyala', 'tria', 'marca', 'indica', 'relaciona', 'completa',
    'home', 'dona', 'persona', 'persones', 'vida', 'món', 'temps', 'grup', 'curs', 'nom',
    'déu', 'fe', 'església', 'bíblia', 'creació', 'oració', 'tasca', 'arbre', 'llum', 'bo'
  ]);

  // Palabras funcionales de alta frecuencia en castellano
  const ES_WORDS = new Set([
    'con', 'del', 'al', 'los', 'las', 'unos', 'unas',
    'pero', 'también', 'tampoco', 'sin', 'hasta', 'mientras', 'según',
    'este', 'esta', 'estos', 'estas', 'aquel', 'aquella', 'aquellos', 'aquellas',
    'mío', 'mía', 'tuyo', 'tuya', 'suyo', 'suya', 'nuestro', 'nuestra',
    'cuál', 'cuáles', 'qué', 'dónde', 'cuándo', 'cómo', 'cuánto', 'cuánta',
    'nada', 'nadie', 'alguien', 'cualquiera',
    'es', 'son', 'era', 'eran', 'será', 'serán', 'sea', 'ha', 'han', 'había',
    'tiene', 'tienen', 'tenía', 'hace', 'hacen', 'hacía', 'dice', 'dicen',
    'respuesta', 'respuestas', 'correcta', 'incorrecta', 'verdadera', 'falsa',
    'siguiente', 'siguientes', 'señala', 'indica', 'elige', 'marca', 'relaciona',
    'dios', 'iglesia', 'biblia', 'creación', 'oración', 'tarea', 'árbol', 'luz', 'bueno'
  ]);

  let esScore = 0;

  for (const w of words) {
    if (VA_WORDS.has(w)) vaScore += 2;
    if (ES_WORDS.has(w)) esScore += 2;
    if (w.includes('ñ')) esScore += 3; // La 'ñ' es exclusiva del castellano
  }

  return vaScore > esScore && vaScore >= 2 ? 'va' : 'es';
}

/**
 * Traduce automáticamente las partes generales del examen al valenciano
 * (cabecera, departamentos, etiquetas de nombre/curso, títulos).
 */
export function getLocalizedHeader(header: ExamHeader, language: 'es' | 'va' | string = 'es'): ExamHeader {
  if (language !== 'va') return header;

  // Diccionario de departamentos habituales en centros educativos
  const deptMap: Record<string, string> = {
    'departamento de religión': 'Departament de Religió',
    'departamento de religion': 'Departament de Religió',
    'departamento de ciencias': 'Departament de Ciències',
    'departamento de ciencias naturales': 'Departament de Ciències Naturals',
    'departamento de biología y geología': 'Departament de Biologia i Geologia',
    'departamento de biologia y geologia': 'Departament de Biologia i Geologia',
    'departamento de física y química': 'Departament de Física i Química',
    'departamento de fisica y quimica': 'Departament de Física i Química',
    'departamento de matemáticas': 'Departament de Matemàtiques',
    'departamento de matematicas': 'Departament de Matemàtiques',
    'departamento de geografía e historia': 'Departament de Geografia i Història',
    'departamento de geografia e historia': 'Departament de Geografia i Història',
    'departamento de historia': 'Departament d\'Història',
    'departamento de lengua castellana y literatura': 'Departament de Llengua Castellana i Literatura',
    'departamento de castellano': 'Departament de Castellà',
    'departamento de valenciano': 'Departament de Valencià',
    'departamento de inglés': 'Departament d\'Anglès',
    'departamento de ingles': 'Departament d\'Anglès',
    'departamento de francés': 'Departament de Francès',
    'departamento de frances': 'Departament de Francès',
    'departamento de música': 'Departament de Música',
    'departamento de musica': 'Departament de Música',
    'departamento de educación física': 'Departament d\'Educació Física',
    'departamento de educacion fisica': 'Departament d\'Educació Física',
    'departamento de filosofía': 'Departament de Filosofia',
    'departamento de filosofia': 'Departament de Filosofia',
    'departamento de tecnología': 'Departament de Tecnologia',
    'departamento de tecnologia': 'Departament de Tecnologia',
    'departamento de artes plásticas': 'Departament d\'Arts Plàstiques',
    'departamento de dibujo': 'Departament de Dibuix',
    'departamento de orientación': 'Departament d\'Orientació',
    'departamento de orientacion': 'Departament d\'Orientació',
    'departamento de economía': 'Departament d\'Economia',
    'departamento de economia': 'Departament d\'Economia',
  };

  const rawDept = header.department || '';
  const cleanDeptKey = rawDept.toLowerCase().trim();
  let translatedDept = deptMap[cleanDeptKey];
  if (!translatedDept) {
    // Reglas de traducción genéricas para departamentos
    translatedDept = rawDept
      .replace(/^departamento\s+de\s+/i, 'Departament de ')
      .replace(/^departamento\s+/i, 'Departament ')
      .replace(/^departament\s+de\s+/i, 'Departament de ');
  }

  // Preservar mayúsculas si el original venía todo en mayúsculas
  if (rawDept.length > 0 && rawDept === rawDept.toUpperCase()) {
    translatedDept = translatedDept.toUpperCase();
  }

  // Título
  const titleMap: Record<string, string> = {
    'examen': 'EXAMEN',
    'examen parcial': 'EXAMEN PARCIAL',
    'examen final': 'EXAMEN FINAL',
    'control': 'CONTROL',
    'prueba': 'PROVA',
    'prueba de evaluación': 'PROVA D\'AVALUACIÓ',
    'evaluación': 'AVALUACIÓ',
    'evaluacion': 'AVALUACIÓ',
    'recuperación': 'RECUPERACIÓ',
    'recuperacion': 'RECUPERACIÓ'
  };
  const cleanTitleKey = (header.title || '').toLowerCase().trim();
  const translatedTitle = titleMap[cleanTitleKey] || header.title;

  // Subtítulo
  const subtitleMap: Record<string, string> = {
    'evaluación de conocimientos generales': 'Avaluació de coneixements generals',
    'evaluacion de conocimientos generales': 'Avaluació de coneixements generals',
    'evaluación continua': 'Avaluació contínua',
    'evaluacion continua': 'Avaluació contínua',
  };
  const cleanSubtitleKey = (header.subtitle || '').toLowerCase().trim();
  let translatedSubtitle = subtitleMap[cleanSubtitleKey] || header.subtitle;
  if (/^unidad\s+/i.test(translatedSubtitle)) {
    translatedSubtitle = translatedSubtitle.replace(/^unidad\s+/i, 'Unitat ');
  }

  // Etiquetas de Nombre y Curso
  const isUpperName = header.nameLabel && header.nameLabel.toUpperCase() === header.nameLabel;
  const nameLabel = isUpperName ? 'NOM' : 'Nom';

  const isUpperCourse = header.courseLabel && header.courseLabel.toUpperCase() === header.courseLabel;
  const courseLabel = isUpperCourse ? 'CURS' : 'Curs';

  return {
    department: translatedDept,
    title: translatedTitle,
    subtitle: translatedSubtitle,
    nameLabel,
    courseLabel
  };
}
