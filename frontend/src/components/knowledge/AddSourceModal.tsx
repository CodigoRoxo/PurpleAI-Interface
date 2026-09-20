import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { KnowledgeSource } from '../../types/knowledge';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<KnowledgeSource>;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onUpload,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSource, setCreatedSource] = useState<KnowledgeSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    try {
      const src = await onUpload(selectedFile);
      setCreatedSource(src);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar arquivo';
      setError(msg);
      setUploading(false);
    }
  };

  const handleDone = () => {
    setSelectedFile(null);
    setCreatedSource(null);
    setUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in select-none">
      <div
        className="relative w-full max-w-lg bg-[#0e0d1c] border border-[#2e2954] rounded-2xl shadow-2xl shadow-purple-950/40 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1c3a] bg-[#121024]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-950/80 border border-purple-800/50 flex items-center justify-center text-purple-300">
              <UploadCloud className="w-4 h-4 text-purple-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Adicionar Material à Base de Conhecimento
              </h3>
              <p className="text-xs text-slate-400">
                PDFs, livros técnicos, manuais, Markdown ou código-fonte
              </p>
            </div>
          </div>
          {!uploading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1f1c3a] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {createdSource ? (
            <div className="py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-950/80 border border-purple-600/50 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Loader2 className="w-6 h-6 text-purple-accent animate-spin" />
              </div>
              <h4 className="text-sm font-semibold text-slate-100 mb-1">
                Indexação Iniciada em Background
              </h4>
              <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
                O arquivo <strong className="text-purple-300">{createdSource.fileName}</strong> está sendo dividido em chunks e vetorizado pelo modelo local.
              </p>
              <div className="p-3 rounded-xl bg-[#080712] border border-[#221e3f] text-xs font-mono text-purple-300 flex items-center justify-center gap-2 mb-6">
                <span>Status:</span>
                <span className="text-slate-200">Indexação em andamento no servidor</span>
              </div>
              <button
                onClick={handleDone}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#6d28d9] to-[#8b5cf6] text-white text-xs font-medium hover:from-[#7c3aed] hover:to-[#9333ea] transition-all shadow-md shadow-purple-900/40"
              >
                Concluir e Voltar
              </button>
            </div>
          ) : (
            <div>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? 'border-purple-500 bg-purple-950/20'
                    : 'border-[#272445] hover:border-purple-600/60 bg-[#090814] hover:bg-[#110f22]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.md,.markdown,.txt,.c,.cpp,.h,.hpp,.asm,.s,.py,.json,.yaml"
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-purple-950/90 border border-purple-600/50 flex items-center justify-center mb-3 text-purple-300">
                      <FileText className="w-6 h-6 text-purple-accent" />
                    </div>
                    <span className="text-xs font-semibold text-slate-200 max-w-xs truncate mb-1">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <span className="text-[11px] text-purple-400 mt-2 hover:underline">
                      Clique para trocar de arquivo
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-[#141226] border border-[#272445] flex items-center justify-center mb-3 text-slate-400">
                      <UploadCloud className="w-6 h-6 text-purple-accent" />
                    </div>
                    <span className="text-xs font-semibold text-slate-200 mb-1">
                      Arraste e solte o arquivo aqui, ou clique para selecionar
                    </span>
                    <span className="text-[11px] text-slate-500 max-w-xs">
                      Suporta PDFs técnicos, livros, documentação Markdown, TXT ou código-fonte (.cpp, .asm, .c, etc.)
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#121024] hover:bg-[#1f1c3a] text-slate-400 hover:text-slate-200 text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleStartUpload}
                  disabled={!selectedFile || uploading}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#6d28d9] to-[#8b5cf6] hover:from-[#7c3aed] hover:to-[#9333ea] disabled:opacity-40 text-white text-xs font-medium transition-all shadow-md shadow-purple-900/40 active:scale-95 disabled:active:scale-100"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Indexando...</span>
                    </>
                  ) : (
                    <span>Adicionar à Base</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
