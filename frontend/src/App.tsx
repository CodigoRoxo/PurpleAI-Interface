import React, { useState } from 'react';
import { useOllama } from './hooks/useOllama';
import { useConversations } from './hooks/useConversations';
import { useChatStream } from './hooks/useChatStream';
import { useKnowledge } from './hooks/useKnowledge';
import { AppLayout } from './components/layout/AppLayout';
import { ChatArea } from './components/chat/ChatArea';
import { KnowledgeView } from './components/knowledge/KnowledgeView';
import { ContextModal } from './components/chat/ContextModal';
import { ChatSourceCitation } from './types/chat';

import { useProjects } from './hooks/useProjects';
import { ProjectView } from './components/projects/ProjectView';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'chat' | 'knowledge' | 'projects'>('chat');
  const [activeContextSources, setActiveContextSources] = useState<ChatSourceCitation[] | null>(null);

  const {
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    addProject,
    deleteProject,
    reindexProject,
    searchProject
  } = useProjects();

  const {
    status,
    models,
    selectedModel,
    selectModel,
    loading: loadingOllama,
  } = useOllama();

  const {
    conversations,
    activeConversationId,
    activeConversation,
    setActiveConversation,
    selectConversation,
    newConversation,
    renameConversation,
    deleteConversation,
    refreshConversations,
  } = useConversations(selectedModel);

  const {
    sources,
    allSources,
    collections,
    selectedCollectionId,
    setSelectedCollectionId,
    stats,
    uploadFile,
    reindex,
    toggleSource,
    deleteSource,
    createCollection,
    deleteCollection,
    testSearch,
    searchResults,
    searching,
    clearSearch,
    getChunks,
    debugTrace,
    debugging,
    executeDebug,
    runSanity,
    sanityResult,
    testingSanity,
    runNegative,
    negativeResult,
    testingNegative,
  } = useKnowledge();

  const {
    sendMessage,
    stopStreaming,
    isStreaming,
    useKnowledge: useKnowledgeState,
    setUseKnowledge: setUseKnowledgeState,
    error,
    clearError,
  } = useChatStream({
    activeConversation,
    setActiveConversation,
    selectedModel,
    newConversation,
    refreshConversations,
    activeProjectId,
  });

  return (
    <AppLayout
      status={status}
      models={models}
      selectedModel={selectedModel}
      onSelectModel={selectModel}
      loadingStatus={loadingOllama}
      conversations={conversations}
      activeConversationId={activeConversationId}
      onSelectConversation={id => {
        setCurrentView('chat');
        selectConversation(id);
      }}
      onNewConversation={() => {
        setCurrentView('chat');
        newConversation(selectedModel);
      }}
      onRenameConversation={renameConversation}
      onDeleteConversation={deleteConversation}
      currentView={currentView}
      onNavigate={view => setCurrentView(view as 'chat' | 'knowledge' | 'projects')}
      activeKnowledgeCount={stats.activeSources}
      projectsCount={projects.length}
    >
      {currentView === 'chat' ? (
        <ChatArea
          messages={activeConversation?.messages || []}
          isStreaming={isStreaming}
          onSend={sendMessage}
          onStop={stopStreaming}
          error={error}
          onClearError={clearError}
          selectedModel={selectedModel}
          onViewContext={sources => setActiveContextSources(sources)}
          useKnowledge={useKnowledgeState}
          onToggleKnowledge={() => setUseKnowledgeState(prev => !prev)}
          activeKnowledgeCount={stats.activeSources}
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={setActiveProjectId}
        />
      ) : currentView === 'knowledge' ? (
        <KnowledgeView
          sources={sources}
          allSources={allSources}
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={setSelectedCollectionId}
          onCreateCollection={createCollection}
          onDeleteCollection={deleteCollection}
          stats={stats}
          uploadFile={uploadFile}
          reindex={reindex}
          toggleSource={toggleSource}
          deleteSource={deleteSource}
          testSearch={testSearch}
          searchResults={searchResults}
          searching={searching}
          clearSearch={clearSearch}
          getChunks={getChunks}
          debugTrace={debugTrace}
          debugging={debugging}
          onExecuteDebug={query => executeDebug(query, { model: selectedModel })}
          onRunSanity={() => runSanity(selectedModel)}
          sanityResult={sanityResult}
          testingSanity={testingSanity}
          onRunNegative={() => runNegative(selectedModel)}
          negativeResult={negativeResult}
          testingNegative={testingNegative}
        />
      ) : (
        <ProjectView 
          projects={projects}
          activeProjectId={activeProjectId}
          activeProject={activeProject}
          onSelectProject={setActiveProjectId}
          onAddProject={addProject}
          onDeleteProject={deleteProject}
          onReindexProject={reindexProject}
          onSearchProject={searchProject}
          onOpenChat={projectId => {
            setActiveProjectId(projectId);
            setCurrentView('chat');
          }}
        />
      )}

      <ContextModal
        isOpen={activeContextSources !== null}
        onClose={() => setActiveContextSources(null)}
        sources={activeContextSources || []}
      />
    </AppLayout>
  );
};

export default App;
