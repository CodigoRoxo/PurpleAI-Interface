import React from 'react';
import { OllamaStatus } from '../../types/model';

interface StatusIndicatorProps {
  status: OllamaStatus;
  loading?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, loading }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-900 border border-dark-700/80 text-xs select-none">
      <span className="relative flex h-2.5 w-2.5">
        {status.connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            loading
              ? 'bg-amber-400'
              : status.connected
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]'
              : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
          }`}
        />
      </span>
      <span className="font-medium text-slate-300">
        {loading
          ? 'Verificando...'
          : status.connected
          ? 'Ollama Conectado'
          : 'Ollama Offline'}
      </span>
      {status.version && (
        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
          v{status.version}
        </span>
      )}
    </div>
  );
};
