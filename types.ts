
export interface Question {
  id: string;
  text: string;
  options: string[];
}

export interface ExamHeader {
  title: string;
  subtitle: string;
  department: string;
  courseLabel: string;
  nameLabel: string;
}

export interface ExamSettings {
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  fontSize: 'sm' | 'base' | 'lg';
}

export interface GeneratedExam {
  versionId: number;
  questions: Question[];
  type: 'standard' | 'adapted'; 
  language: 'es' | 'va'; 
  localizedHeader?: ExamHeader; 
  label?: string; 
  sourceVersionId?: number; // Nuevo: Para saber de qué versión original proviene esta traducción
}

export interface SavedExam {
  id: string;
  timestamp: number;
  name: string; 
  header: ExamHeader;
  parsedQuestions: Question[]; 
  generatedVersions: GeneratedExam[]; 
  settings: ExamSettings;
}
