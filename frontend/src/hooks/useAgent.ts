import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { AgentEvent, AgentSession, AgentSessionSummary, TimelineItem } from '../types/agent';

function applyEvent(timeline: TimelineItem[], event: AgentEvent): TimelineItem[] {
  if (event.type === 'timeline') {
    const idx = timeline.findIndex(t => t.id === event.item.id);
    if (idx === -1) return [...timeline, event.item];
    const next = [...timeline];
    next[idx] = event.item;
    return next;
  }
  if (event.type === 'delta') {
    const idx = timeline.findIndex(t => t.id === event.id);
    if (idx === -1) {
      return [...timeline, { kind: event.kind, id: event.id, text: event.text, timestamp: Date.now() }];
    }
    const item = timeline[idx];
    if (item.kind !== 'assistant' && item.kind !== 'thinking') return timeline;
    const next = [...timeline];
    next[idx] = { ...item, text: item.text + event.text };
    return next;
  }
  return timeline;
}

export function useAgent(projectId: string | null, model: string) {
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    if (!projectId) {
      setSessions([]);
      return;
    }
    try {
      setSessions(await api.listAgentSessions(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar tarefas');
    }
  }, [projectId]);

  useEffect(() => {
    setSession(null);
    loadSessions();
  }, [loadSessions]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Se a tarefa continua rodando em segundo plano (ex.: a página foi recarregada), acompanha por polling
  const followInBackground = useCallback((id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const latest = await api.getAgentSession(id);
        setSession(latest);
        if (!latest.running) {
          stopPolling();
          setRunning(false);
          loadSessions();
        }
      } catch {
        stopPolling();
      }
    }, 1500);
  }, [loadSessions]);

  useEffect(() => stopPolling, []);

  const selectSession = useCallback(async (id: string | null) => {
    stopPolling();
    setError(null);
    if (!id) {
      setSession(null);
      setRunning(false);
      return;
    }
    try {
      const loaded = await api.getAgentSession(id);
      setSession(loaded);
      setRunning(Boolean(loaded.running));
      if (loaded.running) followInBackground(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir tarefa');
    }
  }, [followInBackground]);

  const send = useCallback(async (message: string, think: boolean) => {
    if (!projectId || !message.trim() || running) return;
    if (!model) {
      setError('Selecione um modelo no topo da tela.');
      return;
    }
    setError(null);

    let current = session;
    if (!current) {
      try {
        const created = await api.createAgentSession(projectId, model);
        const title = message.split('\n')[0].slice(0, 60);
        current = { ...created, title };
        setSession(current);
        setSessions(prev => [{ ...created, title, steps: 0 }, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao criar tarefa');
        return;
      }
    }

    const sessionId = current.id;
    setRunning(true);
    try {
      await api.runAgent(sessionId, { message, model, think }, event => {
        setSession(prev => (prev && prev.id === sessionId ? { ...prev, timeline: applyEvent(prev.timeline, event) } : prev));
        if (event.type === 'done' && event.status === 'error' && event.message) setError(event.message);
      });
      const latest = await api.getAgentSession(sessionId);
      setSession(prev => (prev && prev.id === sessionId ? latest : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar o agente');
    } finally {
      setRunning(false);
      loadSessions();
    }
  }, [projectId, model, running, session, loadSessions]);

  const stop = useCallback(async () => {
    if (session) await api.stopAgent(session.id);
  }, [session]);

  const revert = useCallback(async (stepId: string) => {
    if (!session) return;
    try {
      await api.revertAgentStep(session.id, stepId);
      setSession(await api.getAgentSession(session.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desfazer');
    }
  }, [session]);

  const deleteSession = useCallback(async (id: string) => {
    await api.deleteAgentSession(id);
    if (session?.id === id) setSession(null);
    loadSessions();
  }, [session, loadSessions]);

  return {
    sessions,
    session,
    running,
    error,
    clearError: () => setError(null),
    selectSession,
    newSession: () => selectSession(null),
    send,
    stop,
    revert,
    deleteSession,
  };
}
