import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ChatMessage, ChatSourceCitation } from '../../types/chat';
import { Project } from '../../types/project';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

interface ChatAreaProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
  error: string | null;
  onClearError: () => void;
  selectedModel: string;
  onViewContext?: (sources: ChatSourceCitation[]) => void;
  useKnowledge?: boolean;
  onToggleKnowledge?: () => void;
  activeKnowledgeCount?: number;
  projects?: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isStreaming,
  onSend,
  onStop,
  error,
  onClearError,
  selectedModel,
  onViewContext,
  useKnowledge,
  onToggleKnowledge,
  activeKnowledgeCount,
  projects = [],
  activeProjectId,
  onSelectProject,
}) => {
  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-transparent relative">
      {error && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-lg w-[90%] flex items-center justify-between px-4 py-2.5 rounded-lg bg-rose-950/90 border border-rose-800/80 text-rose-200 text-xs shadow-xl shadow-rose-950/40 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={onClearError}
            className="p-1 hover:bg-rose-900/60 rounded text-rose-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onViewContext={onViewContext}
        activeProjectId={activeProjectId}
      />

      <MessageInput
        onSend={onSend}
        onStop={onStop}
        isStreaming={isStreaming}
        disabled={!selectedModel}
        useKnowledge={useKnowledge}
        onToggleKnowledge={onToggleKnowledge}
        activeKnowledgeCount={activeKnowledgeCount}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={onSelectProject}
      />
    </main>
  );
};
