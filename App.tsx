import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Printer, Settings2, FileText, RotateCcw, AlertCircle, LayoutTemplate, Shuffle, Download, RefreshCw, ZoomIn, ZoomOut, ArrowRightLeft, Plus, Minus, Accessibility, Database, FilePlus, Save, Check, X, Globe, Trash2 } from 'lucide-react';
import { Question, ExamHeader, ExamSettings, GeneratedExam, SavedExam } from './types';
import { ExamPaper } from './components/ExamPaper';
import { ExamBank } from './components/ExamBank';
import { cleanQuestionText, cleanOptionText } from './utils/textCleaner';
import { detectLanguage } from './utils/languageDetector';

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
  title: "EXAMEN",
  subtitle: "Tema ...",
  department: "Departamento de Religión",
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
  const [currentLanguage, setCurrentLanguage] = useState<'es' | 'va'>('es');
  
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false);
  
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

  const createVersion = (baseQs: Question[], id: number, currentSettings: ExamSettings, lang: 'es' | 'va'): GeneratedExam => {
      let questionsForVersion = baseQs.map(q => ({
        ...q,
        text: cleanQuestionText(q.text),
        options: (q.options || []).map(cleanOptionText)
      }));
      if (currentSettings.randomizeQuestions) questionsForVersion = shuffleArray(questionsForVersion);
      questionsForVersion = questionsForVersion.map(q => {
        if (currentSettings.randomizeAnswers) return { ...q, options: shuffleArray(q.options) };
        return q;
      });
      return { 
          versionId: id, 
          questions: questionsForVersion, 
          type: 'standard',
          language: lang,
          label: `Ver. ${id}`
      };
  };

  const updateVersionsWithNewContent = (newBaseQuestions: Question[], lang: 'es' | 'va') => {
    const cleanedBaseQuestions = newBaseQuestions.map(q => ({
      ...q,
      text: cleanQuestionText(q.text),
      options: (q.options || []).map(cleanOptionText)
    }));

    if (generatedVersions.length === 0) {
        const initialVersion = createVersion(cleanedBaseQuestions, 1, settings, lang);
        setGeneratedVersions([initialVersion]);
        setCurrentVersionIndex(0);
        return;
    }

    const updated = generatedVersions.map(version => {
      let qs = [...cleanedBaseQuestions];
      if (settings.randomizeQuestions) qs = shuffleArray(qs);
      qs = qs.map(q => {
        if (settings.randomizeAnswers) return { ...q, options: shuffleArray(q.options) };
        return q;
      });
      return {
        ...version,
        language: lang,
        questions: qs
      };
    });
    setGeneratedVersions(updated);
  };

  // --- ACTIONS ---

  const handleProcessText = (textToProcess: string = inputText) => {
    setError(null);
    if (!textToProcess.trim()) return;
    setIsProcessing(true);
    try {
      const blocks = textToProcess.split(/\n\s*\n/);
      const manualQuestions: Question[] = blocks.map((block, idx) => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) return null;
        const text = lines[0];
        const options = lines.slice(1);
        const cleanOptions = options.map(opt => cleanOptionText(opt));
        return {
          id: `q-${idx}-${Date.now()}`,
          text: cleanQuestionText(text),
          options: cleanOptions
        };
      }).filter((q): q is Question => q !== null);

      if (manualQuestions.length === 0) {
        setError("No se detectó un formato válido. Separa cada pregunta con una línea en blanco.");
        setIsProcessing(false);
        return;
      }

      // Detección automática heurística del idioma (sin IA)
      const detectedLang = detectLanguage(textToProcess);
      setCurrentLanguage(detectedLang);

      setParsedQuestions(manualQuestions);
      updateVersionsWithNewContent(manualQuestions, detectedLang);
    } catch (err) {
      setError("Error al procesar el texto.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Cargar texto inicial al inicio
  useEffect(() => {
    handleProcessText(SAMPLE_TEXT);
  }, []);

  const handleNewExam = () => {
    const isDirty = parsedQuestions.length > 0 || (inputText.trim().length > 0 && inputText !== SAMPLE_TEXT);
    
    if (isDirty) {
        if (!window.confirm("Se perderán los cambios no guardados. ¿Deseas empezar un examen nuevo?")) return;
    }
    
    setFormKey(prev => prev + 1);
    setInputText("");
    setParsedQuestions([]);
    setGeneratedVersions([]);
    setHeader({ ...DEFAULT_HEADER });
    setCurrentVersionIndex(0);
    setCurrentLanguage('es');
    setError(null);
    setCurrentExamId(null);
    setCurrentExamName(null);
    setIsSaveModalOpen(false);
    setIsProcessing(false);
    
    setSettings({
        randomizeQuestions: false,
        randomizeAnswers: false,
        fontSize: 'base',
    });
  };

  const handleAddVersion = () => {
      if (parsedQuestions.length === 0) return;
      const standardVersions = generatedVersions.filter(v => v.type === 'standard');
      const maxId = standardVersions.reduce((max, v) => Math.max(max, v.versionId), 0);
      const nextId = maxId + 1;
      const newVersion = createVersion(parsedQuestions, nextId, settings, currentLanguage);
      setGeneratedVersions(prev => [...prev, newVersion]);
      setCurrentVersionIndex(generatedVersions.length);
  };

  const handleRemoveVersion = () => {
      const standardVersions = generatedVersions.filter(v => v.type === 'standard');
      if (standardVersions.length <= 1) return;
      const lastStandard = standardVersions[standardVersions.length - 1];
      const newVersions = generatedVersions.filter(v => v !== lastStandard);
      setGeneratedVersions(newVersions);
      if (currentVersionIndex >= newVersions.length) setCurrentVersionIndex(newVersions.length - 1);
  };

  const handleCreateAdaptedVersion = () => {
      if (parsedQuestions.length === 0) return;
      const existingAdaptedCount = generatedVersions.filter(v => v.type === 'adapted').length;
      const nextAdaptedId = existingAdaptedCount + 1;
      
      let questionsForVersion = parsedQuestions.map(q => ({
        ...q,
        text: cleanQuestionText(q.text),
        options: (q.options || []).map(cleanOptionText)
      }));
      if (settings.randomizeQuestions) questionsForVersion = shuffleArray(questionsForVersion);
      questionsForVersion = questionsForVersion.map(q => {
        if (settings.randomizeAnswers) return { ...q, options: shuffleArray(q.options) };
        return q;
      });

      const newVersion: GeneratedExam = {
          versionId: nextAdaptedId,
          questions: questionsForVersion,
          type: 'adapted',
          language: currentLanguage,
          label: `Adaptada ${nextAdaptedId > 1 ? nextAdaptedId : ''}`.trim()
      };
      setGeneratedVersions(prev => [...prev, newVersion]);
      setCurrentVersionIndex(generatedVersions.length);
  };

  const handleDeleteCurrentVersion = () => {
      if (generatedVersions.length <= 1) return;
      const newVersions = generatedVersions.filter((_, idx) => idx !== currentVersionIndex);
      setGeneratedVersions(newVersions);
      if (currentVersionIndex >= newVersions.length) {
          setCurrentVersionIndex(Math.max(0, newVersions.length - 1));
      }
  };

  const handleSetLanguage = (lang: 'es' | 'va') => {
      setCurrentLanguage(lang);
      setGeneratedVersions(prev => prev.map(v => ({
          ...v,
          language: lang
      })));
  };

  const handleShuffleCurrentVersion = (type: 'questions' | 'answers') => {
    setGeneratedVersions(prevVersions => {
      const newVersions = [...prevVersions];
      const currentVersion = newVersions[currentVersionIndex];
      if (!currentVersion) return prevVersions;
      let newQuestions = currentVersion.questions.map(q => ({
        ...q,
        text: cleanQuestionText(q.text),
        options: (q.options || []).map(cleanOptionText)
      }));

      if (type === 'questions') newQuestions = shuffleArray(newQuestions);
      else if (type === 'answers') newQuestions = newQuestions.map(q => ({...q, options: shuffleArray(q.options)}));

      newVersions[currentVersionIndex] = { ...currentVersion, questions: newQuestions };
      return newVersions;
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
      
      savedExams = savedExams.filter(e => e.id !== exam.id);
      savedExams = [exam, ...savedExams];
      
      localStorage.setItem('examgen_bank', JSON.stringify(savedExams));
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleMainSaveButton = () => {
      if (!examToSave) {
          alert("No hay nada que guardar. Genera preguntas primero.");
          return;
      }

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
      if (parsedQuestions.length > 0 && currentExamId !== saved.id) {
          if(!window.confirm("Cargar un examen reemplazará el trabajo actual. ¿Continuar?")) return;
      }
      
      try {
        const safeHeader = saved.header || DEFAULT_HEADER;
        const safeQuestions = (saved.parsedQuestions || []).map(q => ({
          ...q,
          text: cleanQuestionText(q.text),
          options: (q.options || []).map(cleanOptionText)
        }));
        const safeVersions = (saved.generatedVersions || []).map(v => ({
          ...v,
          questions: (v.questions || []).map(q => ({
            ...q,
            text: cleanQuestionText(q.text),
            options: (q.options || []).map(cleanOptionText)
          }))
        }));
        const safeSettings = saved.settings || settings;

        setHeader(safeHeader);
        setParsedQuestions(safeQuestions);
        setSettings(safeSettings);
        setGeneratedVersions(safeVersions);
        setCurrentVersionIndex(0);
        
        const loadedLang = safeVersions[0]?.language || (safeQuestions.length > 0 ? detectLanguage(safeQuestions.map(q => q.text).join(' ')) : 'es');
        setCurrentLanguage(loadedLang);
        
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Lexend:wght@400;500;600;700&display=swap');
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: white; }
        .font-accessible { font-family: 'Lexend', sans-serif !important; letter-spacing: 0.03em; }
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
                        placeholder="Ej: Religión Tema 1"
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
                <h1 className="font-bold text-xl">ExamGen</h1>
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
                      <FileText size={16} className="text-indigo-600"/>
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
              
              <div className="mt-3 space-y-2">
                 <button 
                   onClick={() => handleProcessText()} 
                   disabled={!inputText.trim() || isProcessing} 
                   className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 shadow-sm"
                 >
                   {isProcessing ? <RotateCcw className="animate-spin" size={16} /> : <RefreshCw size={16} />} 
                   {isProcessing ? 'Procesando...' : 'Actualizar Examen'}
                 </button>

                 <div className="flex items-center justify-between text-xs text-gray-500 pt-1 px-1 bg-gray-50 p-2 rounded-md border border-gray-200/60">
                    <span className="flex items-center gap-1.5">
                      <Globe size={14} className="text-gray-400" />
                      Idioma detectado:
                    </span>
                    <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${currentLanguage === 'va' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                      {currentLanguage === 'va' ? '🥘 Valencià' : '🇪🇸 Castellano'}
                    </span>
                 </div>
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

                   {/* OPCIONES DE ALEATORIZACIÓN */}
                   <div className="pt-2 space-y-2 border-t border-gray-100">
                       <label className="text-xs text-gray-500 block">Opciones de Aleatorización</label>
                       <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
                           <input 
                             type="checkbox" 
                             checked={settings.randomizeQuestions} 
                             onChange={(e) => setSettings(s => ({...s, randomizeQuestions: e.target.checked}))}
                             className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                           />
                           <span>Aleatorizar orden de preguntas al crear versiones</span>
                       </label>
                       <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
                           <input 
                             type="checkbox" 
                             checked={settings.randomizeAnswers} 
                             onChange={(e) => setSettings(s => ({...s, randomizeAnswers: e.target.checked}))}
                             className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                           />
                           <span>Aleatorizar opciones de respuesta al crear versiones</span>
                       </label>
                   </div>
                  
                  {/* CONTROL DE VERSIONES Y ADAPTACIÓN */}
                  <div className="pt-2">
                      <label className="text-xs text-gray-500 block mb-2">Gestión de Versiones</label>
                      <div className="flex gap-2">
                          <div className="flex items-center bg-gray-100 rounded-lg p-1" title="Número de versiones estándar">
                              <button onClick={handleRemoveVersion} className="p-2 hover:bg-white rounded text-gray-600 hover:text-red-500 disabled:opacity-50" disabled={generatedVersions.filter(v => v.type === 'standard').length <= 1}>
                                  <Minus size={16}/>
                              </button>
                              <span className="w-8 text-center text-sm font-medium">{generatedVersions.filter(v => v.type === 'standard').length}</span>
                              <button onClick={handleAddVersion} disabled={parsedQuestions.length === 0} className="p-2 hover:bg-white rounded text-gray-600 hover:text-green-600 disabled:opacity-50">
                                  <Plus size={16}/>
                              </button>
                          </div>
                          
                          <button 
                            onClick={handleCreateAdaptedVersion} 
                            disabled={parsedQuestions.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold rounded-lg px-3 py-2 border bg-indigo-50/80 border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-sm transition-all disabled:opacity-50"
                            title="Genera una versión adaptada para personas con dislexia y/o TDAH con formato accesible, tipografía Lexend y realce de términos clave"
                          >
                             <Accessibility size={16} className="text-indigo-600" />
                             <span>Adaptar (Dislexia / TDAH)</span>
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
             <div className="h-14 flex items-center justify-between px-4 gap-2">
                
                {/* Version Selector Buttons */}
                <div className="flex items-center gap-2 flex-1 overflow-hidden">
                    {generatedVersions.length > 0 ? (
                       <div className="bg-gray-100 p-1 rounded-lg flex gap-1 overflow-x-auto max-w-full scrollbar-hide">
                            {generatedVersions.map((v, idx) => {
                                const isActive = currentVersionIndex === idx;
                                return (
                                    <button 
                                        key={`${v.type}-${v.versionId}-${idx}`} 
                                        onClick={() => setCurrentVersionIndex(idx)} 
                                        className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap flex items-center gap-1.5 transition-all flex-shrink-0 ${isActive ? 'bg-white text-indigo-700 font-bold shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        {v.type === 'adapted' ? (
                                            <span className="flex items-center gap-1 text-indigo-600">
                                              <Accessibility size={13} />
                                              {v.label || `Adaptada ${v.versionId}`}
                                            </span>
                                        ) : (
                                            <span>{v.label || `Ver. ${v.versionId}`}</span>
                                        )}
                                    </button>
                                );
                            })}
                       </div>
                    ) : (
                        <div className="text-xs text-gray-400 italic">
                            Introduce preguntas para previsualizar el examen.
                        </div>
                    )}

                    {generatedVersions.length > 1 && (
                      <button 
                        onClick={handleDeleteCurrentVersion}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        title="Eliminar esta versión"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                </div>

                 <div className="flex items-center gap-3 shrink-0">
                     {/* Language Switcher (Cabeceras y partes generales) */}
                     <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button 
                            onClick={() => handleSetLanguage('es')}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${currentLanguage === 'es' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-800'}`}
                            title="General en Castellano"
                        >
                            <span>🇪🇸</span> Castellano
                        </button>
                        <button 
                            onClick={() => handleSetLanguage('va')}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${currentLanguage === 'va' ? 'bg-white text-amber-700 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-800'}`}
                            title="General en Valencià"
                        >
                            <span>🥘</span> Valencià
                        </button>
                     </div>

                     {/* Zoom Controls */}
                     <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="p-1 hover:bg-white rounded text-gray-600"><ZoomOut size={16}/></button>
                        <span className="text-xs font-mono w-8 text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} className="p-1 hover:bg-white rounded text-gray-600"><ZoomIn size={16}/></button>
                     </div>

                     {/* Action Buttons */}
                     <div className="flex items-center gap-1 border-l pl-3 border-gray-300">
                         <button 
                            onClick={() => handleShuffleCurrentVersion('questions')} 
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mezclar contenido de preguntas (la numeración 1, 2, 3... permanece fija)"
                         >
                            <Shuffle size={14}/> 
                            <span className="hidden xl:inline">Preguntas</span>
                         </button>
                         <button 
                            onClick={() => handleShuffleCurrentVersion('answers')} 
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mezclar opciones de respuesta"
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
                      const startIndex = currentPaginatedExam.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0) + 1;
                      
                      return (
                          <ExamPaper 
                             key={`${currentVer.type}-${currentVer.versionId}-${currentVer.language}-${pageIdx}`}
                             questions={pageQuestions}
                             startIndex={startIndex}
                             header={header}
                             versionId={currentVer.versionId}
                             fontSize={settings.fontSize}
                             examType={currentVer.type}
                             language={currentVer.language || currentLanguage}
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
             
             return pages.map((pageQuestions, pageIdx) => {
                const startIndex = pages.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0) + 1;
                return (
                   <ExamPaper 
                      key={`${version.type}-${version.versionId}-${version.language}-${pageIdx}`}
                      questions={pageQuestions}
                      startIndex={startIndex}
                      header={header}
                      versionId={version.versionId}
                      fontSize={settings.fontSize}
                      examType={version.type}
                      language={version.language || currentLanguage}
                      pageNumber={pageIdx + 1}
                      totalPages={pages.length}
                   />
                );
             });
          })}
      </div>
    </>
  );
}