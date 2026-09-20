import React from 'react';
import { ChevronDown, Sparkles, Menu, Cpu } from 'lucide-react';
import { OllamaModel, OllamaStatus } from '../../types/model';
import { StatusIndicator } from '../ui/StatusIndicator';

interface HeaderProps {
  status: OllamaStatus;
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  loadingStatus: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  models,
  selectedModel,
  onSelectModel,
  loadingStatus,
  onToggleSidebar,
}) => {
  return (
    <header className="h-14 border-b border-[#1c1a32] bg-[#090812]/90 backdrop-blur-md px-4 flex items-center justify-between z-10 select-none">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#18162b] md:hidden transition-colors"
          title="Abrir menu lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6d28d9] to-[#c084fc] flex items-center justify-center shadow-md shadow-purple-900/40">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-white via-slate-200 to-purple-300 bg-clip-text text-transparent">
            PurpleAI
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/40 hidden sm:inline">
            v2.0 RAG
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative inline-block text-left">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111020] border border-[#272445] hover:border-purple-500/60 transition-all cursor-pointer group">
            <Sparkles className="w-3.5 h-3.5 text-purple-accent group-hover:text-purple-glow transition-colors" />
            <select
              value={selectedModel}
              onChange={e => onSelectModel(e.target.value)}
              disabled={models.length === 0}
              className="bg-transparent text-xs font-mono font-medium text-slate-200 outline-none cursor-pointer pr-4 appearance-none"
            >
              {(() => {
                const isEmbedding = (name: string) => {
                  const n = name.toLowerCase();
                  return n.includes('minilm') || n.includes('embed') || n.includes('bge-') || n.includes('mxbai');
                };
                const chatModels = models.filter(m => !isEmbedding(m.name));

                if (chatModels.length === 0) {
                  return (
                    <option value="" className="bg-[#111020] text-slate-400">
                      Nenhum modelo de chat detectado
                    </option>
                  );
                }

                return chatModels.map(m => (
                  <option key={m.name} value={m.name} className="bg-[#111020] text-slate-200">
                    {m.name}
                  </option>
                ));
              })()}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors pointer-events-none absolute right-2.5" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <StatusIndicator status={status} loading={loadingStatus} />
      </div>
    </header>
  );
};
