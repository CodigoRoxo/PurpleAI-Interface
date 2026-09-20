import React, { useState } from 'react';
import { X, BookOpen, FileText, Code2, Sparkles, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { ChatSourceCitation } from '../../types/chat';

interface ContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: ChatSourceCitation[];
}

export const ContextModal: React.FC<ContextModalProps> = ({
  isOpen,
  onClose,
  sources,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen || sources.length === 0) return null;

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <BookOpen className="w-4 h-4 text-rose-400" />;
      case 'code':
        return <Code2 className="w-4 h-4 text-emerald-400" />;
      default:
        return <FileText className="w-4 h-4 text-purple-accent" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div
        className="relative w-full max-w-2xl bg-[#0e0d1c] border border-[#2e2954] rounded-2xl shadow-2xl shadow-purple-950/40 flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1c3a] bg-[#121024]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-950/80 border border-purple-800/50 flex items-center justify-center text-purple-300">
              <Sparkles className="w-4 h-4 text-purple-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Contexto Recuperado (RAG)
              </h3>
              <p className="text-xs text-slate-400">
                {sources.length} {sources.length === 1 ? 'trecho relevante encontrado' : 'trechos relevantes encontrados'} na sua base local
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1f1c3a] transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {sources.map((src, idx) => {
            const isExpanded = expandedIndex === idx;
            const scorePercent = Math.round(src.score * 100);

            return (
              <div
                key={src.id || idx}
                className="rounded-xl border border-[#232042] bg-[#090814] overflow-hidden transition-all"
              >
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-[#121024] select-none transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                    {getSourceIcon(src.sourceType)}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {src.sourceTitle}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {src.pageNumber && (
                          <span className="text-purple-300 font-mono">Pág. {src.pageNumber}</span>
                        )}
                        {src.chapter && (
                          <span className="truncate text-slate-400">§ {src.chapter}</span>
                        )}
                        {src.startLine && src.endLine && (
                          <span className="font-mono text-emerald-400">Linhas {src.startLine}-{src.endLine}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-800/40 text-purple-300">
                      {scorePercent}% match
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-[#1f1c3a] bg-[#07060e] text-xs">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                        Texto Injetado no Contexto:
                      </span>
                      <button
                        onClick={() => handleCopy(src.text, idx)}
                        className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded hover:bg-[#1a182e] transition-colors"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar trecho</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0c0b16] border border-[#1e1c38] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {src.text}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 border-t border-[#1f1c3a] bg-[#121024] flex items-center justify-between text-xs text-slate-500">
          <span>Dados recuperados via busca vetorial local (similaridade de cosseno)</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#1f1c3a] hover:bg-[#2a264e] text-slate-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
