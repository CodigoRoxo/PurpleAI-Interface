import React, { useState } from 'react';
import { X, Search, Copy, Check, BookOpen, Code2, FileText } from 'lucide-react';
import { KnowledgeChunk, KnowledgeSource } from '../../types/knowledge';

interface ChunkViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: KnowledgeSource | null;
  chunks: KnowledgeChunk[];
  loading?: boolean;
}

export const ChunkViewerModal: React.FC<ChunkViewerModalProps> = ({
  isOpen,
  onClose,
  source,
  chunks,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen || !source) return null;

  const filteredChunks = chunks.filter(c =>
    searchTerm ? c.text.toLowerCase().includes(searchTerm.toLowerCase()) : true
  );

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
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
        className="relative w-full max-w-3xl bg-[#0e0d1c] border border-[#2e2954] rounded-2xl shadow-2xl shadow-purple-950/40 flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1c3a] bg-[#121024]">
          <div className="flex items-center gap-3">
            {getSourceIcon(source.type)}
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Trechos Indexados ({chunks.length} chunks)
              </h3>
              <p className="text-xs text-slate-400">
                {source.fileName} · {(source.fileSize / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1f1c3a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-[#1f1c3a] bg-[#0a0916]">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filtrar dentro dos trechos desta fonte..."
              className="w-full pl-9 pr-4 py-2 bg-[#121024] border border-[#272445] rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Carregando trechos indexados...
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Nenhum trecho corresponde ao filtro.
            </div>
          ) : (
            filteredChunks.map((chunk, index) => (
              <div
                key={chunk.id || index}
                className="rounded-xl border border-[#232042] bg-[#090814] overflow-hidden text-xs"
              >
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#121024] border-b border-[#1f1c3a]">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span className="text-purple-300 font-semibold">Chunk #{index + 1}</span>
                    {chunk.pageNumber && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/40">
                        Pág. {chunk.pageNumber}
                      </span>
                    )}
                    {chunk.chapter && (
                      <span className="text-slate-400 truncate max-w-xs">§ {chunk.chapter}</span>
                    )}
                    {chunk.startLine && chunk.endLine && (
                      <span className="text-emerald-400">Linhas {chunk.startLine}-{chunk.endLine}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopy(chunk.id, chunk.text)}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded hover:bg-[#1f1c3a] transition-colors"
                  >
                    {copiedId === chunk.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 font-mono text-slate-300 whitespace-pre-wrap leading-relaxed text-[12px] max-h-48 overflow-y-auto">
                  {chunk.text}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-3 border-t border-[#1f1c3a] bg-[#121024] flex items-center justify-between text-xs text-slate-500">
          <span>Mostrando {filteredChunks.length} de {chunks.length} chunks</span>
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
