import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Conversation, ConversationSummary } from '../types/chat';

export function useConversations(currentModel: string) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadConversations = useCallback(async () => {
    try {
      const list = await api.listConversations();
      setConversations(list);
      return list;
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const selectConversation = useCallback(async (id: string | null) => {
    setActiveConversationId(id);
    if (!id) {
      setActiveConversation(null);
      return;
    }

    try {
      const conv = await api.getConversation(id);
      setActiveConversation(conv);
    } catch (err) {
      console.error('Erro ao carregar detalhes da conversa:', err);
      setActiveConversation(null);
    }
  }, []);

  const newConversation = useCallback(async (modelOverride?: string) => {
    const modelToUse = modelOverride || currentModel || 'default';
    try {
      const created = await api.createConversation({
        title: 'Nova Conversa',
        model: modelToUse,
      });

      await loadConversations();
      setActiveConversationId(created.id);
      setActiveConversation(created);
      return created;
    } catch (err) {
      console.error('Erro ao criar nova conversa:', err);
      return null;
    }
  }, [currentModel, loadConversations]);

  const renameConversation = useCallback(async (id: string, newTitle: string) => {
    try {
      const updated = await api.updateConversation(id, { title: newTitle });
      setConversations(prev =>
        prev.map(c => (c.id === id ? { ...c, title: updated.title } : c))
      );
      if (activeConversationId === id) {
        setActiveConversation(prev => (prev ? { ...prev, title: updated.title } : null));
      }
    } catch (err) {
      console.error('Erro ao renomear conversa:', err);
    }
  }, [activeConversationId]);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setActiveConversation(null);
      }
    } catch (err) {
      console.error('Erro ao excluir conversa:', err);
    }
  }, [activeConversationId]);

  useEffect(() => {
    loadConversations().then(list => {
      if (list.length > 0 && !activeConversationId) {
        selectConversation(list[0].id);
      }
    });
  }, [loadConversations]);

  return {
    conversations,
    activeConversationId,
    activeConversation,
    setActiveConversation,
    selectConversation,
    newConversation,
    renameConversation,
    deleteConversation,
    refreshConversations: loadConversations,
    loading,
  };
}
