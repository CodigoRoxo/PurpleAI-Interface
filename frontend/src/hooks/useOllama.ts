import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { OllamaModel, OllamaStatus } from '../types/model';

const STORAGE_KEY_MODEL = 'purpleai_selected_model';

export function useOllama() {
  const [status, setStatus] = useState<OllamaStatus>({ connected: false });
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_MODEL) || '';
  });
  const [loading, setLoading] = useState<boolean>(true);

  const checkConnection = useCallback(async () => {
    try {
      const s = await api.getOllamaStatus();
      setStatus(s);
      if (s.connected) {
        const m = await api.getOllamaModels();
        setModels(m);

        const isEmbedding = (name: string) => {
          const n = name.toLowerCase();
          return n.includes('minilm') || n.includes('embed') || n.includes('bge-') || n.includes('mxbai');
        };
        const chatModels = m.filter(model => !isEmbedding(model.name));

        setSelectedModel(prev => {
          if (prev && chatModels.some(model => model.name === prev)) {
            return prev;
          }
          if (chatModels.length > 0) {
            const defaultModel = chatModels[0].name;
            localStorage.setItem(STORAGE_KEY_MODEL, defaultModel);
            return defaultModel;
          }
          return '';
        });
      }
    } catch {
      setStatus({ connected: false, error: 'Ollama offline' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 25000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const selectModel = (modelName: string) => {
    setSelectedModel(modelName);
    localStorage.setItem(STORAGE_KEY_MODEL, modelName);
  };

  return {
    status,
    models,
    selectedModel,
    selectModel,
    loading,
    refresh: checkConnection,
  };
}
