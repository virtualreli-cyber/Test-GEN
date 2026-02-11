import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bot, Printer, Settings2, FileText, RotateCcw, AlertCircle, LayoutTemplate, Shuffle, Download, RefreshCw, ZoomIn, ZoomOut, ArrowRightLeft, Plus, Minus, Accessibility, Languages, Database, FilePlus, Save, Check, X, RefreshCcw } from 'lucide-react';
import { parseQuestionsFromText, adaptQuestionsForAccessibility, translateExamContent } from './services/geminiService';
import { Question, ExamHeader, ExamSettings, GeneratedExam, SavedExam } from './types';
import { ExamPaper } from './components/ExamPaper';
import { ExamBank } from './components/ExamBank';

// --- UTILITIES ---

function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

const paginateQuestions = (questions: Question[], fontSize: string, type: 'standard' | 'adapted'): Question[][] => {
  if (questions.length === 0) return [];

  const pages: Question[][] = [];
  let currentPage: Question[] = [];
  
  const COLUMNS = 2;
  const PAGE_HEIGHT_UNITS = 1200 * COLUMNS; 
  const HEADER_COST_P1 = 500; 
  const HEADER_COST_PN = 100; 
  
  let currentCapacity = PAGE_HEIGHT_UNITS - HEADER_COST_P1;
  let currentUsed = 0;

  // Factor de tamaño
  let fontFactor = fontSize === 'sm' ? 0.85 : fontSize === 'lg' ? 1.2 : 1.0;
  if (type === 'adapted') {
      fontFactor = 1.6; 
  }

  questions.forEach((q) => {
    const textCost = q.text.length * 0.5; 
    const optionsCost = q.options.reduce((acc, opt) => acc + (opt.length * 0.5) + 20, 0);
    const baseMargin = type === 'adapted' ? 60 : 40;
    const questionCost = (baseMargin + textCost + optionsCost) * fontFactor;

    if (currentUsed + questionCost > currentCapacity && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentUsed = 0;
      currentCapacity = PAGE_HEIGHT_UNITS - HEADER_COST_PN;
    }

    currentPage.push(q);
    currentUsed += questionCost;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
};


// --- CONSTANTS ---

const DEFAULT_HEADER: ExamHeader = {
  title: "EXAMEN PARCIAL",
  subtitle: "Evaluación de conocimientos generales",
  department: "Departamento de Ciencias",
  nameLabel: "Nombre",
  courseLabel: "Curso",
};

const SAMPLE_TEXT = `¿Cuál es la capital de Francia?
París
Londres
Madrid
Berlín

¿Cuál es el elemento químico más abundante en el universo?
Hidrógeno
Oxígeno
Carbono
Helio

¿En qué año llegó el hombre a la luna?
1969
1950
1975
1980

¿Quién escribió "Cien años de soledad"?
Gabriel García Márquez
Mario Vargas Llosa
Jorge Luis Borges
Pablo Neruda`;

export default function App() {
  // State
  const [inputText, setInputText] = useState<string>(SAMPLE_TEXT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdapting, setIsAdapting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  
  const [generatedVersions, setGeneratedVersions] = useState<GeneratedExam[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  
  const [zoom, setZoom] = useState(0.75); 
  const [printMode, setPrintMode] = useState<'all' | 'current'>('all');
  const [header, setHeader] = useState<ExamHeader>(DEFAULT_HEADER);
  
  const [settings, setSettings] = useState<ExamSettings>({
    randomizeQuestions: false,
    randomizeAnswers: false,
    fontSize: 'base',
  });

  // UI States
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false); // Feedback visual
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [languageTab, setLanguageTab] = useState<'es' | 'va'>('es');
  
  // Tracking State for Save/Update
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [currentExamName, setCurrentExamName] = useState<string | null>(null);
  
  // Modal de "Guardar Como"
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newExamNameInput, setNewExamNameInput] = useState('');
  const saveNameInputRef = useRef<HTMLInputElement>(null);
  
  // Force Reset Key for inputs
  const [formKey, setFormKey] = useState(0);

  // --- HELPERS ---

  const createVersion = (baseQs: Question[], id: number, currentSettings: ExamSettings): GeneratedExam => {
      let questionsForVersion = [...baseQs];
      if (currentSettings.randomizeQuestions) questionsForVersion = shuffleArray(questionsForVersion);
      questionsForVersion = questionsForVersion.map(q => {
        if (currentSettings.randomizeAnswers) return { ...q, options: shuffleArray(q.options) };
        return q;
      });
      return { 
          versionId: id, 
          questions: questionsForVersion, 
          type: 'standard',
          language: 'es',
          label: `Ver. ${id}`
      };
  };

  const updateVersionsWithNewContent = async (newBaseQuestions: Question[]) => {
    if (generatedVersions.length === 0) {
        const initialVersion = createVersion(newBaseQuestions, 1, settings);
        setGeneratedVersions([initialVersion]);
        setCurrentVersionIndex(0);
        return;
    }

    const updatedVersionsPromise = generatedVersions.map(async (version) => {
        if (version.type === 'standard' && version.language === 'es') {
            let qs = [...newBaseQuestions];
            if (settings.randomizeQuestions) qs = shuffleArray(qs);
            qs = qs.map(q => {
                if (settings.randomizeAnswers) return { ...q, options: shuffleArray(q.options) };
                return q;
            });
            return { ...version, questions: qs };
        } 
        
        if (version.type === 'adapted' && version.language === 'es') {
            try {
                const adaptedQs = await adaptQuestionsForAccessibility(newBaseQuestions);
                return { ...version, questions: adaptedQs };
            } catch (err) {
                console.error("No se pudo actualizar la versión adaptada", err);
                return version; 
            }
        }
        
        return version; 
    });

    const results = await Promise.all(updatedVersionsPromise);
    setGeneratedVersions(results);
    setCurrentVersionIndex(0); 
  };

  // --- ACTIONS ---

  const handleNewExam = () => {
    // Si hay trabajo en curso, confirmamos
    const isDirty = parsedQuestions.length > 0 || (inputText.trim().length > 0 && inputText !== SAMPLE_TEXT);
    
    if (isDirty) {
        if (!window.confirm("Se perderán los cambios no guardados. ¿Deseas empezar un examen nuevo?")) return;
    }
    
    // Reseteo COMPLETO
    setFormKey(prev => prev + 1); // Force re-mount of inputs
    setInputText("");
    setParsedQuestions([]);
    setGeneratedVersions([]);
    setHeader({ ...DEFAULT_HEADER });
    setCurrentVersionIndex(0);
    setLanguageTab('es');
    setError(null);
    setCurrentExamId(null);
    setCurrentExamName(null);
    setIsSaveModalOpen(false);
    
    // Reset flags
    setIsProcessing(false);
    setIsAdapting(false);
    setIsTranslating(false);
    
    // Resetear configuración
    setSettings({
        randomizeQuestions: false,
        randomizeAnswers: false,
        fontSize: 'base',
    });
  };

  const handleProcessAI = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const questions = await parseQuestionsFromText(inputText);
      setParsedQuestions(questions);
      await updateVersionsWithNewContent(questions);
    } catch (err) {
      setError("Hubo un error al procesar el texto.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualRefresh = async () => {
    setError(null);
    if (!inputText.trim()) return;
    setIsProcessing(true);
    try {
      const blocks = inputText.split(/\n\s*\n/);
      const manualQuestions: Question[] = blocks.map((block, idx) => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) return null;
        const text = lines[0];
        const options = lines.slice(1);
        const cleanOptions = options.map(opt => opt.replace(/^([a-z0-9][\.\)]|-)\s*/i, ''));
        return {
          id: `manual-${idx}-${Date.now()}`,
          text: text.replace(/^\d+[\.\)]\s*/, ''),
          options: cleanOptions
        };
      }).filter((q): q is Question => q !== null);

      if (manualQuestions.length === 0) {
        setError("No se detectó un formato válido.");
        setIsProcessing(false);
        return;
      }
      
      setParsedQuestions(manualQuestions);
      await updateVersionsWithNewContent(manualQuestions);
    } catch (err) {
      setError("Error al procesar el texto manualmente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddVersion = () => {
      if (parsedQuestions.length === 0) return;
      setLanguageTab('es'); 
      const maxId = generatedVersions.reduce((max, v) => v.type === 'standard' && v.language === 'es' ? Math.max(max, v.versionId) : max, 0);
      const nextId = maxId + 1;
      const newVersion = createVersion(parsedQuestions, nextId, settings);
      setGeneratedVersions(prev => [...prev, newVersion]);
  };

  const handleRemoveVersion = () => {
      const standardVersions = generatedVersions.filter(v => v.type === 'standard' && v.language === 'es');
      if (standardVersions.length <= 1) return;
      const lastStandard = standardVersions[standardVersions.length - 1];
      const newVersions = generatedVersions.filter(v => v !== lastStandard);
      setGeneratedVersions(newVersions);
      if (currentVersionIndex >= newVersions.length) setCurrentVersionIndex(newVersions.length - 1);
  };

  const handleGenerateAdapted = async () => {
      if (parsedQuestions.length === 0) return;
      setLanguageTab('es');
      setIsAdapting(true);
      setError(null);
      try {
          const adaptedQuestions = await adaptQuestionsForAccessibility(parsedQuestions);
          const existingAdaptedCount = generatedVersions.filter(v => v.type === 'adapted' && v.language === 'es').length;
          const nextAdaptedId = existingAdaptedCount + 1;
          const newVersion: GeneratedExam = {
              versionId: nextAdaptedId,
              questions: adaptedQuestions,
              type: 'adapted',
              language: 'es',
              label: `Adaptada ${nextAdaptedId > 1 ? nextAdaptedId : ''}`.trim()
          };
          setGeneratedVersions(prev => [...prev, newVersion]);
      } catch (err) {
          setError("Error al generar la adaptación.");
      } finally {
          setIsAdapting(false);
      }
  };

  const handleTranslateMissing = async () => {
      if (generatedVersions.length === 0) return;
      
      setIsTranslating(true);
      setError(null);

      // Wrapper con timeout para evitar que se cuelgue infinitamente
      const translateWithTimeout = async (promise: Promise<any>) => {
          let timeoutHandle;
          const timeoutPromise = new Promise((_, reject) => {
              timeoutHandle = setTimeout(() => reject(new Error("La traducción tardó demasiado. Intenta con menos preguntas.")), 30000);
          });
          return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
      };

      try {
          const sourceVersions = generatedVersions.filter(v => v.language === 'es');
          const existingTranslations = generatedVersions.filter(v => v.language === 'va');
          
          const versionsToTranslate = sourceVersions.filter(sv => {
              const hasTranslation = existingTranslations.some(tv => 
                  tv.sourceVersionId === sv.versionId && tv.type === sv.type
              );
              return !hasTranslation;
          });

          if (versionsToTranslate.length === 0) {
              alert("Todas las versiones actuales ya tienen su traducción al Valenciano.");
              setIsTranslating(false);
              setLanguageTab('va'); 
              return;
          }
          
          const newTranslatedVersions: GeneratedExam[] = [];

          for (const version of versionsToTranslate) {
             const { questions: translatedQs, header: translatedHeader } = await translateWithTimeout(
                 translateExamContent(version.questions, header)
             ) as any;
             
             newTranslatedVersions.push({
                 ...version,
                 questions: translatedQs,
                 localizedHeader: translatedHeader,
                 language: 'va',
                 label: `${version.label}`, 
                 sourceVersionId: version.versionId 
             });
          }

          setGeneratedVersions(prev => [...prev, ...newTranslatedVersions]);
          setLanguageTab('va'); 

      } catch (err: any) {
          console.error(err);
          setError(err.message || "Error durante la traducción.");
      } finally {
          setIsTranslating(false);
      }
  };

  const handleShuffleCurrentVersion = (type: 'questions' | 'answers') => {
    setGeneratedVersions(prevVersions => {
      const newVersions = [...prevVersions];
      const currentVersion = newVersions[currentVersionIndex];
      let newQuestions = currentVersion.questions.map(q => ({...q, options: [...q.options]}));

      if (type === 'questions') newQuestions = shuffleArray(newQuestions);
      else if (type === 'answers') newQuestions = newQuestions.map(q => ({...q, options: shuffleArray(q.options)}));

      newVersions[currentVersionIndex] = { ...currentVersion, questions: newQuestions };
      return newVersions;
    });
  };

  // Función para restaurar el orden de las preguntas al original castellano
  const handleSyncValencianOrder = () => {
      const currentVer = generatedVersions[currentVersionIndex];
      if (!currentVer || currentVer.language !== 'va' || !currentVer.sourceVersionId) return;

      const sourceVer = generatedVersions.find(v => v.versionId === currentVer.sourceVersionId && v.language === 'es' && v.type === currentVer.type);
      
      if (!sourceVer) {
          alert("No se encontró la versión original en castellano para sincronizar.");
          return;
      }

      // Creamos un mapa de índices basado en los IDs de la versión original
      // Asumimos que la traducción MANTIENE los IDs (como se instruye al prompt)
      const targetIdOrder = sourceVer.questions.map(q => q.id);

      const reorderedQuestions = [...currentVer.questions].sort((a, b) => {
          const indexA = targetIdOrder.indexOf(a.id);
          const indexB = targetIdOrder.indexOf(b.id);
          // Si no encuentra el ID (raro), lo pone al final
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
      });

      setGeneratedVersions(prev => {
          const newV = [...prev];
          newV[currentVersionIndex] = { ...currentVer, questions: reorderedQuestions };
          return newV;
      });
  };

  // --- LOGICA DE GUARDADO ---
  
  const examToSave: Omit<SavedExam, 'id' | 'timestamp' | 'name'> | null = useMemo(() => {
      if (parsedQuestions.length === 0) return null; 
      return {
          header,
          parsedQuestions,
          generatedVersions,
          settings
      };
  }, [header, parsedQuestions, generatedVersions, settings]);

  const saveToLocalStorage = (exam: SavedExam) => {
      const savedExamsRaw = localStorage.getItem('examgen_bank');
      let savedExams: SavedExam[] = savedExamsRaw ? JSON.parse(savedExamsRaw) : [];
      
      // Remover si existe (para sobrescribir)
      savedExams = savedExams.filter(e => e.id !== exam.id);
      // Añadir al principio
      savedExams = [exam, ...savedExams];
      
      localStorage.setItem('examgen_bank', JSON.stringify(savedExams));
      
      // Feedback UI
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleMainSaveButton = () => {
      if (!examToSave) {
          alert("No hay nada que guardar. Genera preguntas primero.");
          return;
      }

      // CASO 1: Examen ya existe -> GUARDADO AUTOMÁTICO (Sobrescribir)
      if (currentExamId && currentExamName) {
          const updatedExam: SavedExam = {
              ...examToSave,
              id: currentExamId,
              name: currentExamName,
              timestamp: Date.now()
          };
          saveToLocalStorage(updatedExam);
          return;
      }

      // CASO 2: Examen Nuevo -> Pedir Nombre
      setNewExamNameInput(header.title || '');
      setIsSaveModalOpen(true);
      setTimeout(() => saveNameInputRef.current?.focus(), 100);
  };

  const confirmSaveNew = () => {
      if (!newExamNameInput.trim() || !examToSave) return;
      
      const newId = crypto.randomUUID();
      const newExam: SavedExam = {
          ...examToSave,
          id: newId,
          name: newExamNameInput.trim(),
          timestamp: Date.now()
      };
      
      saveToLocalStorage(newExam);
      setCurrentExamId(newId);
      setCurrentExamName(newExam.name);
      setIsSaveModalOpen(false);
  };

  const handleLoadExam = (saved: SavedExam) => {
      // Si hay cambios no guardados en un examen diferente, avisar
      if (parsedQuestions.length > 0 && currentExamId !== saved.id) {
          if(!window.confirm("Cargar un examen reemplazará el trabajo actual. ¿Continuar?")) return;
      }
      
      try {
        const safeHeader = saved.header || DEFAULT_HEADER;
        const safeQuestions = saved.parsedQuestions || [];
        const safeVersions = saved.generatedVersions || [];
        const safeSettings = saved.settings || settings;

        setHeader(safeHeader);
        setParsedQuestions(safeQuestions);
        setSettings(safeSettings);
        setGeneratedVersions(safeVersions);
        setCurrentVersionIndex(0);
        setLanguageTab('es');
        
        if (safeQuestions.length > 0) {
            const text = safeQuestions.map(q => `${q.text}\n${q.options.join('\n')}`).join('\n\n');
            setInputText(text);
        }

        setCurrentExamId(saved.id);
        setCurrentExamName(saved.name);
      } catch (e) {
          console.error("Error loading exam payload", e);
          alert("Error al cargar los datos del examen.");
      }
  };

  // --- UI HELPERS ---

  const visibleVersions = useMemo(() => {
      return generatedVersions.filter(v => v.language === languageTab);
  }, [generatedVersions, languageTab]);

  useEffect(() => {
     if (visibleVersions.length > 0) {
         const selectedGlobal = generatedVersions[currentVersionIndex];
         if (selectedGlobal && selectedGlobal.language !== languageTab) {
             const firstOfLangIndex = generatedVersions.findIndex(v => v.language === languageTab);
             if (firstOfLangIndex !== -1) {
                 setCurrentVersionIndex(firstOfLangIndex);
             }
         }
     }
  }, [languageTab, generatedVersions, currentVersionIndex, visibleVersions]);

  const currentPaginatedExam = useMemo(() => {
    if (generatedVersions.length === 0) return [];
    const currentVer = generatedVersions[currentVersionIndex];
    if (!currentVer) return [];
    return paginateQuestions(currentVer.questions, settings.fontSize, currentVer.type);
  }, [generatedVersions, currentVersionIndex, settings.fontSize]);

  // --- PRINT LOGIC ---
  const executePrintInNewWindow = () => {
    const printContent = document.getElementById('print-container');
    if (!printContent) return;

    const newWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!newWindow) {
      alert("Por favor, permite las ventanas emergentes.");
      return;
    }

    const tailwindLink = '<script src="https://cdn.tailwindcss.com"></script>';
    const criticalCSS = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: white; }
        .exam-columns { column-count: 2; column-gap: 2rem; width: 100%; height: 100%; }
        .question-card { break-inside: avoid; page-break-inside: avoid; display: inline-block; width: 100%; margin-bottom: 1rem; }
        .paper-sheet {
            width: 210mm; height: 297mm;
            padding: 15mm; margin: 0;
            box-sizing: border-box;
            display: flex; flex-direction: column;
            page-break-after: always;
        }
        .paper-sheet:last-child { page-break-after: auto; }
        .paper-content { flex: 1; overflow: hidden; }
        #print-container { display: block !important; }
        .print-only { display: block !important; }
        @media print {
            @page { size: A4; margin: 0; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      </style>
    `;

    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Imprimir Examen</title>${tailwindLink}${criticalCSS}</head>
        <body>${printContent.innerHTML}<script>window.onload = () => { setTimeout(() => { window.print(); }, 800); };</script></body>
      </html>
    `);
    newWindow.document.close();
  };

  const handlePrintAll = () => { setPrintMode('all'); setTimeout(() => executePrintInNewWindow(), 100); };
  const handlePrintCurrent = () => { setPrintMode('current'); setTimeout(() => executePrintInNewWindow(), 100); };

  return (
    <>
      <div className="no-print flex h-screen overflow-hidden text-gray-800 font-sans">
        
        <ExamBank 
            isOpen={isBankOpen} 
            onClose={() => setIsBankOpen(false)} 
            onLoadExam={handleLoadExam}
            currentExamId={currentExamId}
        />

        {/* MODAL DE GUARDAR COMO */}
        {isSaveModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Guardar Nuevo Examen</h3>
                        <button onClick={() => setIsSaveModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Introduce un nombre para identificar este examen en el banco.</p>
                    <input 
                        ref={saveNameInputRef}
                        type="text" 
                        className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Ej: Matemáticas Tema 1"
                        value={newExamNameInput}
                        onChange={(e) => setNewExamNameInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmSaveNew()}
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button onClick={confirmSaveNew} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Guardar</button>
                    </div>
                </div>
            </div>
        )}

        {/* --- LEFT SIDEBAR --- */}
        <div className="w-full md:w-[450px] bg-white border-r border-gray-200 flex flex-col h-full shadow-lg z-10">
           {/* Header Branding */}
          <div className="p-4 border-b border-gray-100 bg-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
                <FileText size={24} />
                <h1 className="font-bold text-xl">ExamGen AI</h1>
            </div>
            <div className="flex gap-2">
                 <button 
                    onClick={handleNewExam}
                    className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-white transition-colors flex items-center gap-1 text-xs font-medium"
                    title="Nuevo Examen (Limpia editor)"
                >
                    <FilePlus size={16} /> <span className="hidden sm:inline">Nuevo</span>
                </button>
                 <button 
                    onClick={handleMainSaveButton}
                    disabled={!examToSave}
                    className={`p-2 rounded-lg transition-all flex items-center gap-1 text-xs font-bold border border-transparent ${saveSuccess ? 'bg-green-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white disabled:opacity-50'}`}
                    title={currentExamId ? "Guardar cambios" : "Guardar como nuevo"}
                >
                    {saveSuccess ? <Check size={16} /> : <Save size={16} />} 
                    <span className="hidden sm:inline">{saveSuccess ? '¡OK!' : 'Guardar'}</span>
                </button>
                <button 
                    onClick={() => setIsBankOpen(true)}
                    className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-white transition-colors flex items-center gap-1 text-xs font-medium"
                    title="Abrir Banco y Backups"
                >
                    <Database size={16} /> <span className="hidden sm:inline">Banco</span>
                </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8" key={formKey}>
            {/* Input Section */}
            <section>
               <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Bot size={16} className="text-indigo-600"/>
                      Entrada de Texto
                  </label>
                  {currentExamId && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full border border-indigo-100 truncate max-w-[150px]">
                          Editando: {currentExamName}
                      </span>
                  )}
              </div>
              <textarea
                className="w-full h-48 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Escribe aquí tus preguntas o pega el texto..."
              ></textarea>
              {error && <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}
              <div className="grid grid-cols-2 gap-2 mt-3">
                 <button onClick={handleManualRefresh} disabled={!inputText.trim() || isProcessing} className="py-2.5 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                   {isProcessing && !isAdapting && !isTranslating ? <RotateCcw className="animate-spin" size={16} /> : <RefreshCw size={16} />} 
                   {isProcessing && !isAdapting && !isTranslating ? 'Cargando...' : 'Vista Rápida'}
                </button>
                <button onClick={handleProcessAI} disabled={isProcessing || !inputText.trim()} className={`py-2.5 px-3 rounded-lg text-white font-medium flex items-center justify-center gap-2 text-sm transition-all ${isProcessing ? 'bg-gray-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {isProcessing ? <RotateCcw className="animate-spin" size={16} /> : <Bot size={16} />} {isProcessing ? "IA..." : "IA (Mejorar)"}
                </button>
              </div>
            </section>

             {/* Header Settings */}
            <section className="space-y-3">
               <div className="flex items-center gap-2 mb-2 border-b pb-2 border-gray-100">
                  <LayoutTemplate size={16} className="text-gray-500" />
                  <h3 className="text-sm font-bold text-gray-800">Encabezado</h3>
               </div>
               <input type="text" placeholder="Título" value={header.title} onChange={(e) => setHeader({...header, title: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm"/>
               <input type="text" placeholder="Subtítulo" value={header.subtitle} onChange={(e) => setHeader({...header, subtitle: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm"/>
               <input type="text" placeholder="Departamento" value={header.department} onChange={(e) => setHeader({...header, department: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm"/>
            </section>

             {/* Global Settings */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 mb-2 border-b pb-2 border-gray-100">
                  <Settings2 size={16} className="text-gray-500" />
                  <h3 className="text-sm font-bold text-gray-800">Configuración Global</h3>
               </div>
                
                 <div>
                      <label className="text-xs text-gray-500 block mb-1">Tamaño de Fuente (Estándar)</label>
                      <div className="flex bg-gray-100 rounded p-1">
                          {(['sm', 'base', 'lg'] as const).map((size) => (
                               <button key={size} onClick={() => setSettings(s => ({...s, fontSize: size}))} className={`flex-1 text-xs py-1 rounded transition-colors ${settings.fontSize === size ? 'bg-white shadow text-indigo-600 font-medium' : 'text-gray-500 hover:bg-gray-200'}`}>
                                  {size === 'sm' ? 'Pequeña' : size === 'base' ? 'Media' : 'Grande'}
                               </button>
                          ))}
                      </div>
                  </div>
                  
                  {/* CONTROL DE VERSIONES ACTUALIZADO */}
                  <div className="pt-2">
                      <label className="text-xs text-gray-500 block mb-2">Gestión de Versiones (Castellano)</label>
                      <div className="flex gap-2">
                          <div className="flex items-center bg-gray-100 rounded-lg p-1">
                              <button onClick={handleRemoveVersion} className="p-2 hover:bg-white rounded text-gray-600 hover:text-red-500 disabled:opacity-50" disabled={generatedVersions.filter(v => v.type === 'standard' && v.language === 'es').length <= 1}>
                                  <Minus size={16}/>
                              </button>
                              <span className="w-8 text-center text-sm font-medium">{generatedVersions.filter(v => v.type === 'standard' && v.language === 'es').length}</span>
                              <button onClick={handleAddVersion} disabled={generatedVersions.length === 0} className="p-2 hover:bg-white rounded text-gray-600 hover:text-green-600 disabled:opacity-50">
                                  <Plus size={16}/>
                              </button>
                          </div>
                          
                          <button 
                            onClick={handleGenerateAdapted} 
                            disabled={parsedQuestions.length === 0 || isAdapting || isTranslating}
                            className={`flex-1 flex items-center justify-center gap-2 text-xs font-medium rounded-lg px-2 border transition-all ${isAdapting ? 'bg-indigo-50 border-indigo-200 text-indigo-400' : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm'}`}
                          >
                             {isAdapting ? <RotateCcw className="animate-spin" size={14}/> : <Accessibility size={16} />}
                             {isAdapting ? 'Creando...' : 'Crear Adaptada'}
                          </button>
                      </div>
                  </div>
            </section>
          </div>

           <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button onClick={handlePrintAll} disabled={generatedVersions.length === 0} className="w-full py-3 px-4 rounded-lg bg-gray-900 text-white font-medium hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <Printer size={18} /> Imprimir Todo ({generatedVersions.length})
              </button>
          </div>
        </div>

        {/* --- RIGHT PREVIEW AREA --- */}
        <div className="flex-1 bg-gray-200 relative flex flex-col h-full overflow-hidden">
          
          {/* Top Toolbar */}
          <div className="bg-white border-b border-gray-200 flex flex-col z-20 shrink-0 shadow-sm">
             
             {/* TABS DE IDIOMA */}
             <div className="flex px-4 pt-2 gap-4 border-b border-gray-100">
                <button 
                    onClick={() => setLanguageTab('es')}
                    className={`pb-2 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${languageTab === 'es' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <span className="text-lg">🇪🇸</span> Castellano
                </button>
                <button 
                    onClick={() => setLanguageTab('va')}
                    className={`pb-2 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${languageTab === 'va' ? 'border-yellow-500 text-yellow-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                     <span className="text-lg">🥘</span> Valencià
                </button>
             </div>

             <div className="h-14 flex items-center justify-between px-4">
                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                     {/* Version Switcher (Filtered by Language) */}
                    {visibleVersions.length > 0 ? (
                       <div className="bg-gray-100 p-1 rounded-lg flex gap-1 overflow-x-auto max-w-full scrollbar-hide">
                            {visibleVersions.map((v) => {
                                // Find global index
                                const globalIndex = generatedVersions.indexOf(v);
                                const isActive = currentVersionIndex === globalIndex;
                                return (
                                    <button 
                                        key={`${v.type}-${v.versionId}-${v.language}`} 
                                        onClick={() => setCurrentVersionIndex(globalIndex)} 
                                        className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap flex items-center gap-1 transition-all flex-shrink-0 ${isActive ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        {v.type === 'adapted' && <Accessibility size={12} className="-ml-1" />}
                                        {v.label || `Ver. ${v.versionId}`}
                                    </button>
                                );
                            })}
                       </div>
                    ) : (
                        // Empty State for Tab
                        <div className="text-xs text-gray-400 flex items-center gap-2 italic">
                            {languageTab === 'va' ? 'No hay traducciones aún.' : 'Genera una versión para empezar.'}
                            {languageTab === 'va' && parsedQuestions.length > 0 && (
                                 <button 
                                    onClick={handleTranslateMissing}
                                    className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded border border-yellow-200 font-medium hover:bg-yellow-100 flex items-center gap-1"
                                    disabled={isTranslating}
                                 >
                                     <Languages size={12}/> {isTranslating ? 'Traduciendo...' : 'Traducir todo ahora'}
                                 </button>
                            )}
                        </div>
                    )}
                </div>

                 <div className="flex items-center gap-3 ml-4">
                     {/* Translation Action (If in Valencian Tab and revisions exist) */}
                     {languageTab === 'va' && visibleVersions.length > 0 && (
                          <button 
                             onClick={handleTranslateMissing}
                             className="text-xs font-medium text-yellow-700 hover:underline flex items-center gap-1 mr-2"
                             title="Traducir nuevas versiones o adaptaciones"
                             disabled={isTranslating}
                          >
                             {isTranslating ? <RotateCcw className="animate-spin" size={12}/> : <Languages size={12}/>}
                             {isTranslating ? '...' : 'Actualizar'}
                          </button>
                     )}

                     {/* Zoom Controls */}
                     <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="p-1 hover:bg-white rounded text-gray-600"><ZoomOut size={16}/></button>
                        <span className="text-xs font-mono w-8 text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} className="p-1 hover:bg-white rounded text-gray-600"><ZoomIn size={16}/></button>
                     </div>

                     {/* Action Buttons */}
                     <div className="flex items-center gap-1 border-l pl-4 border-gray-300">
                         {languageTab === 'va' && (
                             <button 
                                onClick={handleSyncValencianOrder} 
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors mr-1"
                                title="Sincronizar orden con original (Deshacer mezcla)"
                             >
                                <RefreshCcw size={14}/> 
                                <span className="hidden 2xl:inline">Orden ES</span>
                             </button>
                         )}

                         <button 
                            onClick={() => handleShuffleCurrentVersion('questions')} 
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mezclar Preguntas"
                         >
                            <Shuffle size={14}/> 
                            <span className="hidden xl:inline">Preguntas</span>
                         </button>
                         <button 
                            onClick={() => handleShuffleCurrentVersion('answers')} 
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mezclar Respuestas"
                         >
                            <ArrowRightLeft size={14}/> 
                            <span className="hidden xl:inline">Respuestas</span>
                         </button>
                     </div>
                     
                     <div className="w-px h-5 bg-gray-300 mx-1"></div>

                     <button onClick={handlePrintCurrent} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white font-medium rounded-lg text-sm hover:bg-indigo-700 shadow-sm">
                        <Download size={16}/> 
                        <span className="hidden lg:inline">PDF</span>
                     </button>
                 </div>
              </div>
          </div>

          {/* Scrollable Preview Canvas */}
          <div className="flex-1 overflow-auto p-8 relative flex flex-col items-center bg-gray-200/50">
             {generatedVersions.length > 0 ? (
                <div 
                  className="transition-transform origin-top duration-200 ease-out"
                  style={{ transform: `scale(${zoom})`, marginBottom: `${(currentPaginatedExam.length * 300)}mm` }} 
                >
                   {/* RENDERIZADO DE PÁGINAS INDIVIDUALES */}
                   {currentPaginatedExam.map((pageQuestions, pageIdx) => {
                      const currentVer = generatedVersions[currentVersionIndex];
                      if (!currentVer) return null;
                      
                      return (
                          <ExamPaper 
                             key={`${currentVer.versionId}-${pageIdx}`}
                             questions={pageQuestions}
                             header={currentVer.localizedHeader || header}
                             versionId={currentVer.versionId}
                             fontSize={settings.fontSize}
                             examType={currentVer.type}
                             language={currentVer.language}
                             pageNumber={pageIdx + 1}
                             totalPages={currentPaginatedExam.length}
                          />
                      );
                   })}
                </div>
             ) : (
                <div className="flex flex-col items-center justify-center mt-20 opacity-50">
                    <FileText size={64} className="text-gray-400 mb-4"/>
                    <p>La vista previa aparecerá aquí</p>
                </div>
             )}
          </div>

        </div>
      </div>

      {/* --- HIDDEN PRINT RENDERER --- */}
      <div id="print-container" className="hidden print-only">
          {(printMode === 'all' ? generatedVersions : [generatedVersions[currentVersionIndex]]).map((version) => {
             if (!version) return null;
             const pages = paginateQuestions(version.questions, settings.fontSize, version.type);
             
             return pages.map((pageQuestions, pageIdx) => (
                <ExamPaper 
                   key={`${version.type}-${version.versionId}-${version.language}-${pageIdx}`}
                   questions={pageQuestions}
                   header={version.localizedHeader || header}
                   versionId={version.versionId}
                   fontSize={settings.fontSize}
                   examType={version.type}
                   language={version.language}
                   pageNumber={pageIdx + 1}
                   totalPages={pages.length}
                />
             ));
          })}
      </div>
    </>
  );
}