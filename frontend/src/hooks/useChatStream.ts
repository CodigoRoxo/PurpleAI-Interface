import { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { ChatMessage, Conversation } from '../types/chat';

interface UseChatStreamProps {
  activeConversation: Conversation | null;
  setActiveConversation: React.Dispatch<React.SetStateAction<Conversation | null>>;
  selectedModel: string;
  newConversation: (model?: string) => Promise<Conversation | null>;
  refreshConversations: () => Promise<unknown>;
  activeProjectId?: string | null;
}

export function useChatStream({
  activeConversation,
  setActiveConversation,
  selectedModel,
  newConversation,
  refreshConversations,
  activeProjectId,
}: UseChatStreamProps) {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [useKnowledge, setUseKnowledge] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;
    if (!selectedModel) {
      setError('Nenhum modelo selecionado ou Ollama não disponível.');
      return;
    }

    setError(null);
    let targetConv = activeConversation;
    const now = Date.now();

    const userMessage: ChatMessage = {
      id: `user-${now}`,
      role: 'user',
      content,
      timestamp: now,
    };

    const assistantPlaceholderId = `assistant-${now}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      timestamp: now,
    };

    if (!targetConv) {
      const newId = crypto.randomUUID();
      const firstLine = content.split('\n')[0].trim();
      targetConv = {
        id: newId,
        title: firstLine.slice(0, 40) + (firstLine.length > 40 ? '...' : '') || 'Nova Conversa',
        model: selectedModel,
        createdAt: now,
        updatedAt: now,
        messages: [userMessage, assistantPlaceholder],
      };
      setActiveConversation(targetConv);
    } else {
      const updatedMessages = [...targetConv.messages, userMessage];
      setActiveConversation({
        ...targetConv,
        messages: [...updatedMessages, assistantPlaceholder],
      });
    }

    setIsStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const previousMessages = targetConv.messages.filter(m => m.id !== assistantPlaceholderId);
    const historyPayload = [
      ...previousMessages.map(m => ({ role: m.role, content: m.content })),
      { role: userMessage.role, content: userMessage.content },
    ];

    let accumulatedResponse = '';

    await api.streamChat({
      model: selectedModel,
      messages: historyPayload,
      conversationId: targetConv.id,
      useKnowledge,
      projectId: activeProjectId || undefined,
      signal: controller.signal,
      onSources: (sources) => {
        setActiveConversation(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: prev.messages.map(m =>
              m.id === assistantPlaceholderId
                ? { ...m, sources }
                : m
            ),
          };
        });
      },
      onChunk: (chunk: string) => {
        accumulatedResponse += chunk;
        setActiveConversation(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: prev.messages.map(m =>
              m.id === assistantPlaceholderId
                ? { ...m, content: accumulatedResponse }
                : m
            ),
          };
        });
      },
      onDone: () => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        refreshConversations();
      },
      onError: (err: Error) => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        setError(err.message || 'Erro ao gerar resposta.');
        refreshConversations();
      },
    });
  }, [
    activeConversation,
    setActiveConversation,
    selectedModel,
    isStreaming,
    useKnowledge,
    activeProjectId,
    newConversation,
    refreshConversations,
  ]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      refreshConversations();
    }
  }, [refreshConversations]);

  return {
    sendMessage,
    stopStreaming,
    isStreaming,
    useKnowledge,
    setUseKnowledge,
    error,
    clearError: () => setError(null),
  };
}
