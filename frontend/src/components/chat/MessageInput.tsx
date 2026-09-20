import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Square, Sparkles, FolderCode } from 'lucide-react';
import { Project } from '../../types/project';

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  useKnowledge?: boolean;
  onToggleKnowledge?: () => void;
  activeKnowledgeCount?: number;
  projects?: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onStop,
  isStreaming,
  disabled,
  useKnowledge = true,
  onToggleKnowledge,
  activeKnowledgeCount,
  projects = [],
  activeProjectId,
  onSelectProject,
}) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSubmit = () => {
    if (isStreaming) {
      onStop();
      return;
    }

    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 select-none">
      <div className="relative flex items-end bg-[#0e0d1c] border border-[#272445] rounded-2xl p-2.5 shadow-xl shadow-black/40 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/50 transition-all">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Conectando ao Ollama...'
              : activeProjectId
              ? 'Pergunte ou solicite alterações no projeto selecionado... (Shift+Enter quebra linha)'
              : 'Digite uma mensagem ou pergunta sobre código... (Shift+Enter quebra linha)'
          }
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-[14.5px] resize-none outline-none max-h-48 px-2 py-1 leading-relaxed disabled:opacity-50"
        />

        <div className="flex items-center gap-1.5 pl-2 pb-0.5">
          {projects.length > 0 && (
            <div className="relative inline-block">
              <select
                value={activeProjectId || ''}
                onChange={e => onSelectProject?.(e.target.value ? e.target.value : null)}
                className={`text-xs font-mono font-medium px-2.5 py-1.5 rounded-xl border outline-none cursor-pointer transition-all appearance-none pr-6 bg-[#141226] max-w-[130px] sm:max-w-[160px] truncate ${
                  activeProjectId
                    ? 'border-purple-600/70 text-purple-300 shadow-[0_0_12px_rgba(139,92,246,0.25)]'
                    : 'border-[#272445] text-slate-400 hover:text-slate-300'
                }`}
                title="Selecione o projeto ativo para contextualizar o chat e permitir aplicar modificações no código"
              >
                <option value="" className="bg-[#111020] text-slate-400">Sem Projeto</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#111020] text-slate-200">
                    {p.name}
                  </option>
                ))}
              </select>
              <FolderCode className={`w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${activeProjectId ? 'text-purple-400' : 'text-slate-500'}`} />
            </div>
          )}

          {onToggleKnowledge && (
            <button
              type="button"
              onClick={onToggleKnowledge}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                useKnowledge
                  ? 'bg-purple-950/90 text-purple-300 border border-purple-700/60 shadow-[0_0_12px_rgba(139,92,246,0.25)]'
                  : 'bg-[#141226] text-slate-500 border border-[#272445] hover:text-slate-400'
              }`}
              title={useKnowledge ? 'Base de conhecimento ativa (RAG)' : 'Base de conhecimento desligada'}
            >
              <Sparkles className={`w-3.5 h-3.5 ${useKnowledge ? 'text-purple-accent' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">RAG</span>
              {activeKnowledgeCount !== undefined && activeKnowledgeCount > 0 && useKnowledge && (
                <span className="w-3.5 h-3.5 rounded-full bg-purple-600 text-white text-[9px] flex items-center justify-center font-mono">
                  {activeKnowledgeCount}
                </span>
              )}
            </button>
          )}

          {isStreaming ? (
            <button
              onClick={onStop}
              className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-900/30 active:scale-95"
              title="Interromper geração"
            >
              <Square className="w-4 h-4 fill-white" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={disabled || !content.trim()}
              className="p-2 rounded-xl bg-gradient-to-r from-[#6d28d9] to-[#8b5cf6] hover:from-[#7c3aed] hover:to-[#a855f7] disabled:opacity-30 disabled:hover:from-[#6d28d9] disabled:hover:to-[#8b5cf6] text-white transition-all shadow-md shadow-purple-900/40 active:scale-95 disabled:active:scale-100"
              title="Enviar mensagem (Enter)"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="text-center mt-2">
        <span className="text-[11px] text-slate-500">
          PurpleAI executa inferência através do motor local Ollama.
        </span>
      </div>
    </div>
  );
};
