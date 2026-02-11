import React from 'react';
import { Question, ExamHeader } from '../types';

interface ExamPaperProps {
  questions: Question[];
  header: ExamHeader;
  versionId?: number;
  fontSize: 'sm' | 'base' | 'lg';
  examType: 'standard' | 'adapted';
  language?: 'es' | 'va'; // Prop de idioma
  pageNumber: number;
  totalPages: number;
}

export const ExamPaper: React.FC<ExamPaperProps> = ({ 
  questions, 
  header, 
  versionId, 
  fontSize,
  examType,
  language = 'es',
  pageNumber,
  totalPages
}) => {
  
  let containerClasses = "";
  
  if (examType === 'adapted') {
    containerClasses = "text-lg leading-loose tracking-wide font-sans"; 
  } else {
    const textSizeClass = {
        'sm': 'text-xs',
        'base': 'text-sm',
        'lg': 'text-base'
    }[fontSize];
    containerClasses = `${textSizeClass} leading-snug`;
  }

  const isFirstPage = pageNumber === 1;

  // Código de versión con sufijos
  const stealthVersionCode = versionId 
    ? `${new Date().getFullYear()}-${versionId.toString().padStart(3, '0')}${examType === 'adapted' ? 'A' : ''}${language === 'va' ? 'V' : ''}`
    : null;

  // Textos fijos según idioma (aunque el header viene traducido, el footer no)
  const pageLabel = language === 'va' ? 'Pàgina' : 'Página';
  const ofLabel = language === 'va' ? 'de' : 'de';

  return (
    <div className={`paper-sheet text-black ${examType === 'adapted' ? 'font-medium' : ''}`}>
      
      {/* --- ENCABEZADO SUPERIOR (Running Header) --- */}
      <div className="w-full flex justify-between items-center border-b-2 border-gray-800 pb-2 mb-4 h-[15mm]">
         <span className="uppercase font-bold tracking-wider text-xs">{header.department}</span>
         <div className="flex gap-4 text-xs">
            <span className="font-semibold text-gray-600 truncate max-w-[300px]">{header.title}</span>
            <div className="flex gap-1">
                {language === 'va' && <span className="bg-yellow-100 text-yellow-800 px-1 rounded text-[10px] font-bold border border-yellow-200">VAL</span>}
                {examType === 'adapted' && <span className="bg-indigo-100 text-indigo-800 px-1 rounded text-[10px] font-bold border border-indigo-200" title="Versión Adaptada">A.C.</span>}
            </div>
         </div>
      </div>

      {/* --- PORTADA (Solo Página 1) --- */}
      {isFirstPage && (
        <div className="mb-6 pb-4 border-b border-gray-200">
          <div className="flex flex-row justify-between items-start gap-8">
            <div className="flex-1">
              <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">{header.title}</h1>
              <h2 className="text-lg font-medium text-gray-700">{header.subtitle}</h2>
            </div>
            
            <div className="w-1/3 flex flex-col items-end space-y-3 pt-1">
               <div className="w-full">
                  <div className="flex items-end border-b border-gray-400 pb-1">
                      <span className="text-[10px] font-bold mr-2 uppercase w-12 text-right text-gray-500">{header.nameLabel}</span>
                      <span className="flex-grow"></span>
                  </div>
              </div>
              <div className="w-full">
                  <div className="flex items-end border-b border-gray-400 pb-1">
                      <span className="text-[10px] font-bold mr-2 uppercase w-12 text-right text-gray-500">{header.courseLabel}</span>
                      <span className="flex-grow"></span>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CUERPO DE PREGUNTAS (Columnas) --- */}
      <div className="paper-content">
        <div className={`exam-columns text-justify ${containerClasses}`}>
          {questions.map((q, idx) => (
            <div key={q.id} className="question-card group">
              <div className="font-bold mb-1 text-gray-900 flex gap-1">
                <span className="select-none text-indigo-900">►</span>
                <span>
                    {q.text.split(/(\*\*.*?\*\*)/).map((part, i) => 
                        part.startsWith('**') && part.endsWith('**') 
                        ? <strong key={i} className="text-black bg-yellow-100/50 px-0.5 rounded">{part.slice(2, -2)}</strong> 
                        : part
                    )}
                </span>
              </div>
              <ul className={`pl-3 ${examType === 'adapted' ? 'space-y-2' : 'space-y-0.5'}`}>
                {q.options.map((opt, optIdx) => (
                  <li key={optIdx} className="flex items-baseline relative">
                    <span className={`flex-shrink-0 rounded-full border border-gray-400 flex items-center justify-center font-bold text-gray-600 mr-2 mt-0.5 ${examType === 'adapted' ? 'w-6 h-6 text-xs' : 'w-4 h-4 text-[9px]'}`}>
                      {String.fromCharCode(97 + optIdx)}
                    </span>
                    <span className="text-gray-800">{opt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* --- PIE DE PÁGINA --- */}
      <div className="h-[10mm] border-t border-gray-200 mt-auto flex items-end justify-between text-[10px] text-gray-400">
         <div className="flex gap-4">
            <span>{new Date().toLocaleDateString()}</span>
            {stealthVersionCode && (
                <span className="text-gray-300 font-mono select-none">Ref: {stealthVersionCode}</span>
            )}
         </div>
         <span>{pageLabel} {pageNumber} {ofLabel} {totalPages}</span>
      </div>

    </div>
  );
};