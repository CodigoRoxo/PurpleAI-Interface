import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Square, Sparkles, FolderCode, Eraser, Cpu, Info, Library } from 'lucide-react';
import { Project } from '../../types/project';
import { ContextUsageInfo } from '../../types/chat';
import { KnowledgeCollection, NO_COLLECTION } from '../../types/knowledge';

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  useKnowledge?: boolean;
  onToggleKnowledge?: () => void;
  activeKnowledgeCount?: number;
  knowledgeCollections?: KnowledgeCollection[];
  knowledgeCollectionId?: string;
  onSelectKnowledgeCollection?: (id: string) => void;
  projects?: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
  onClearContext?: () => void;
  contextUsage?: ContextUsageInfo | null;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onStop,
  isStreaming,
  disabled,
  useKnowledge = true,
  onToggleKnowledge,
  activeKnowledgeCount,
  knowledgeCollections = [],
  knowledgeCollectionId = '',
  onSelectKnowledgeCollection,
  projects = [],
  activeProjectId,
  onSelectProject,
  onClearContext,
  contextUsage,
}) => {
  const [content, setContent] = useState('');
  const [showContextDetails, setShowContextDetails] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const totalTokens = contextUsage?.totalTokens || 0;
  const maxTokens = contextUsage?.maxTokens || 16384;
  const promptTokens = contextUsage?.promptTokens || 0;
  const completionTokens = contextUsage?.completionTokens || 0;
  const percentage = contextUsage ? Math.min(100, Math.max(0, contextUsage.percentage)) : 0;

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return `${tokens}`;
  };

  const getStatusStyles = () => {
    if (percentage >= 85) {
      return {
        bar: 'bg-gradient-to-r from-rose-600 via-pink-500 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse',
        text: 'text-rose-400 font-bold',
        badge: 'bg-rose-950/80 border border-rose-800 text-rose-300',
        icon: 'text-rose-400 animate-pulse',
      };
    }
    if (percentage >= 65) {
      return {
        bar: 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]',
        text: 'text-amber-400 font-semibold',
        badge: 'bg-amber-950/80 border border-amber-800/80 text-amber-300',
        icon: 'text-amber-400',
      };
    }
    return {
      bar: 'bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]',
      text: 'text-purple-300',
      badge: 'bg-purple-950/70 border border-purple-800/60 text-purple-300',
      icon: 'text-purple-400',
    };
  };

  const statusStyles = getStatusStyles();

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
    <div className="w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1550px] mx-auto px-3 sm:px-6 lg:px-8 pb-4 select-none">
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

          {onToggleKnowledge && useKnowledge && onSelectKnowledgeCollection && knowledgeCollections.length > 0 && (
            <div className="relative">
              <select
                value={knowledgeCollectionId}
                onChange={e => onSelectKnowledgeCollection(e.target.value)}
                className={`appearance-none pl-2.5 pr-6 py-1.5 rounded-xl text-xs font-mono font-medium cursor-pointer transition-all focus:outline-none max-w-[150px] truncate ${
                  knowledgeCollectionId
                    ? 'bg-purple-950/90 text-purple-300 border border-purple-700/60'
                    : 'bg-[#141226] text-slate-400 border border-[#272445] hover:text-slate-300'
                }`}
                title="Coleções consultadas pelo RAG. Auto: o PurpleAI escolhe as coleções relevantes para cada pergunta"
              >
                <option value="" className="bg-[#111020] text-slate-300">Auto</option>
                {knowledgeCollections.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#111020] text-slate-200">
                    {c.name}
                  </option>
                ))}
                <option value={NO_COLLECTION} className="bg-[#111020] text-slate-400">Sem coleção</option>
              </select>
              <Library className={`w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${knowledgeCollectionId ? 'text-purple-400' : 'text-slate-500'}`} />
            </div>
          )}

          {onClearContext && (
            <button
              type="button"
              onClick={onClearContext}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all bg-[#141226] hover:bg-[#201c38] text-slate-400 hover:text-amber-300 border border-[#272445] hover:border-amber-600/50"
              title="Limpar histórico de mensagens para liberar a janela de contexto do modelo"
            >
              <Eraser className="w-3.5 h-3.5 text-amber-400/80" />
              <span className="hidden sm:inline">Limpar Ctx</span>
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

      {/* HUD Context Progress Bar */}
      <div className="relative mt-2 px-1">
        {showContextDetails && (
          <div
            className="absolute bottom-9 left-1/2 -translate-x-1/2 w-80 bg-[#121024]/95 border border-[#2e2a52] rounded-xl p-3 shadow-2xl z-30 text-xs backdrop-blur-md animate-in fade-in zoom-in-95"
            onMouseLeave={() => setShowContextDetails(false)}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#232040] mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>Uso da Janela de Contexto</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${statusStyles.badge}`}>
                {percentage}%
              </span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Prompt / Histórico / RAG:</span>
                <span className="text-slate-200">{promptTokens.toLocaleString()} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Última Resposta:</span>
                <span className="text-slate-200">{completionTokens.toLocaleString()} tokens</span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t border-[#232040]">
                <span className="text-slate-300">Total Utilizado:</span>
                <span className={statusStyles.text}>{totalTokens.toLocaleString()} tokens</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Capacidade Máxima (num_ctx):</span>
                <span>{maxTokens.toLocaleString()} tokens</span>
              </div>
            </div>
            {percentage >= 80 && (
              <div className="mt-2.5 pt-2 border-t border-[#232040] text-[10.5px] text-amber-300 flex items-start gap-1.5 leading-tight">
                <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-400 mt-0.5" />
                <span>Dica: Contexto elevado. Use "Limpar Ctx" se desejar iniciar um novo tema com 100% de memória livre.</span>
              </div>
            )}
          </div>
        )}

        <div
          className="flex items-center justify-between gap-3 cursor-pointer select-none group"
          onClick={() => setShowContextDetails(prev => !prev)}
          onMouseEnter={() => setShowContextDetails(true)}
          onMouseLeave={() => setShowContextDetails(false)}
          title="Clique para ver o detalhamento do consumo de tokens da conversa"
        >
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Cpu className={`w-3.5 h-3.5 ${statusStyles.icon}`} />
            <span className="font-mono text-[11px] font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
              Contexto:
            </span>
          </div>

          <div className="flex-1 h-2 bg-[#121022] border border-[#272445] rounded-full overflow-hidden p-[1px] relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${statusStyles.bar}`}
              style={{ width: `${Math.max(percentage, totalTokens > 0 ? 3 : 0)}%` }}
            />
          </div>

          <div className="flex items-center gap-1.5 text-right flex-shrink-0 font-mono text-[11px]">
            <span className={`${statusStyles.text} group-hover:brightness-110 transition-all`}>
              {formatTokens(totalTokens)} / {formatTokens(maxTokens)}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusStyles.badge}`}>
              {percentage}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
