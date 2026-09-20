import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { OllamaModel, OllamaStatus } from '../../types/model';
import { ConversationSummary } from '../../types/chat';

interface AppLayoutProps {
  status: OllamaStatus;
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  loadingStatus: boolean;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  currentView: 'chat' | 'knowledge' | 'projects';
  onNavigate: (view: 'chat' | 'knowledge' | 'projects') => void;
  activeKnowledgeCount?: number;
  projectsCount?: number;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  status,
  models,
  selectedModel,
  onSelectModel,
  loadingStatus,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  currentView,
  onNavigate,
  activeKnowledgeCount,
  projectsCount,
  children,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden cyber-grid-bg relative text-slate-100">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_40%_at_50%_-10%,rgba(139,92,246,0.15),transparent_70%)] z-0" />

      <Header
        status={status}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={onSelectModel}
        loadingStatus={loadingStatus}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
      />

      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={onSelectConversation}
          onNew={onNewConversation}
          onRename={onRenameConversation}
          onDelete={onDeleteConversation}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentView={currentView}
          onNavigate={onNavigate}
          activeKnowledgeCount={activeKnowledgeCount}
          projectsCount={projectsCount}
        />
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
};
