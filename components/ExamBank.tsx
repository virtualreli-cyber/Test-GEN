import React, { useState, useEffect, useRef } from 'react';
import { SavedExam } from '../types';
import { Trash2, FolderOpen, X, Database, Download, Upload, FileJson } from 'lucide-react';

interface ExamBankProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadExam: (exam: SavedExam) => void;
  currentExamId: string | null; // Solo para resaltar el actual
}

export const ExamBank: React.FC<ExamBankProps> = ({ isOpen, onClose, onLoadExam, currentExamId }) => {
  const [savedExams, setSavedExams] = useState<SavedExam[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper para cargar del localStorage
  const refreshExams = () => {
      const loaded = localStorage.getItem('examgen_bank');
      if (loaded) {
        try {
          setSavedExams(JSON.parse(loaded));
        } catch (e) {
          console.error("Error loading exams", e);
          setSavedExams([]);
        }
      } else {
          setSavedExams([]);
      }
  };

  // Cargar exámenes al montar o abrir
  useEffect(() => {
    if (isOpen) {
      refreshExams();
    }
  }, [isOpen]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar abrir el examen al hacer click en borrar
    if (!window.confirm('¿Seguro que quieres eliminar este examen del banco permanentemente?')) return;
    
    const updatedList = savedExams.filter(exam => exam.id !== id);
    setSavedExams(updatedList);
    localStorage.setItem('examgen_bank', JSON.stringify(updatedList));
  };

  const handleOpen = (exam: SavedExam) => {
      onLoadExam(exam);
      onClose();
  };

  // --- EXPORTAR / IMPORTAR ---
  
  const handleExportBackup = () => {
    if (savedExams.length === 0) {
      alert("No hay exámenes para exportar.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedExams));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "examgen_backup_" + new Date().toISOString().slice(0,10) + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            // Validar estructura básica
            const validExams = parsed.filter((ex: any) => ex.id && ex.name && ex.header);
            
            if (validExams.length === 0) {
                alert("No se encontraron exámenes válidos en el archivo.");
                return;
            }

            // Mezclar evitando duplicados por ID (Prioridad al archivo importado si queremos actualizar, o a lo local? 
            // Usualmente importar sobrescribe o añade. Aquí añadimos los que no existen)
            const existingIds = new Set(savedExams.map(ex => ex.id));
            const newExams = validExams.filter((ex: any) => !existingIds.has(ex.id));
            
            // Si queremos que la importación actualice existentes, la lógica sería diferente.
            // Por seguridad, solo añadimos nuevos.
            const merged = [...newExams, ...savedExams];
            
            // ACTUALIZACIÓN CRÍTICA: Guardar y actualizar estado local
            localStorage.setItem('examgen_bank', JSON.stringify(merged));
            setSavedExams(merged); 

            alert(`Importación completada. Se añadieron ${newExams.length} exámenes nuevos.`);
        } else {
            alert("Formato de archivo inválido. Debe ser un array JSON.");
        }
      } catch (err) {
        console.error(err);
        alert("Error al leer el archivo. Asegúrate de que es un JSON válido.");
      }
    };
    reader.readAsText(file);
    
    // Resetear el valor para permitir importar el mismo archivo de nuevo si se desea
    event.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      {/* Drawer */}
      <div className="relative w-full md:w-[450px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2 text-gray-800">
             <Database size={20} className="text-indigo-600"/>
             <h2 className="font-bold text-lg">Banco de Exámenes</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Lista de Exámenes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
           <div className="flex justify-between items-end mb-2">
              <h3 className="text-xs font-bold uppercase text-gray-500">Guardados ({savedExams.length})</h3>
              <div className="flex gap-2">
                  <button onClick={handleExportBackup} className="text-[10px] flex items-center gap-1 text-gray-600 hover:text-indigo-600 border bg-white px-2 py-1 rounded shadow-sm">
                      <Download size={12}/> Exportar
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="text-[10px] flex items-center gap-1 text-gray-600 hover:text-indigo-600 border bg-white px-2 py-1 rounded shadow-sm">
                      <Upload size={12}/> Importar
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImportBackup} className="hidden" accept=".json" />
              </div>
           </div>

           {savedExams.length === 0 ? (
             <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg bg-white">
               <Database size={48} className="mx-auto mb-2 opacity-20"/>
               <p className="text-sm">No hay exámenes guardados.</p>
               <p className="text-xs mt-1">Usa el botón "Guardar" en la pantalla principal.</p>
             </div>
           ) : (
             savedExams.map(exam => (
               <div 
                    key={exam.id} 
                    className={`border rounded-lg p-3 transition-all bg-white group relative cursor-pointer ${currentExamId === exam.id ? 'border-indigo-400 ring-1 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'}`}
                    onClick={() => handleOpen(exam)}
                >
                  <div className="flex justify-between items-start mb-1">
                     <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                         {exam.name}
                         {currentExamId === exam.id && <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 rounded-full">EDITANDO</span>}
                     </h4>
                     {/* Botón de borrar con z-index alto para asegurar click */}
                     <button 
                        onClick={(e) => handleDelete(exam.id, e)} 
                        className="relative z-10 text-gray-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors" 
                        title="Eliminar del Banco"
                     >
                        <Trash2 size={16} />
                     </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3 truncate">{exam.header.title} - {exam.header.subtitle}</p>
                  
                  <div className="flex justify-between items-center text-[10px] text-gray-400 border-t pt-2 border-gray-50">
                     <span>{new Date(exam.timestamp).toLocaleDateString()}</span>
                     <div className="flex items-center gap-2">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">
                            {(exam.generatedVersions || []).length} ver.
                        </span>
                        <div className="flex items-center gap-1 text-indigo-600 font-bold px-2 py-1 rounded-md">
                           <FolderOpen size={12}/> Abrir
                        </div>
                     </div>
                  </div>
               </div>
             ))
           )}
        </div>
        
        <div className="p-3 bg-yellow-50 text-[10px] text-yellow-700 text-center border-t border-yellow-100">
           <p className="font-bold flex items-center justify-center gap-1"><FileJson size={12}/> Almacenamiento Local</p>
           Los datos se guardan en este navegador. Haz copias de seguridad regularmente.
        </div>
      </div>
    </div>
  );
};