import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import {
  KnowledgeSource,
  KnowledgeStats,
  KnowledgeSearchResult,
  KnowledgeChunk,
  KnowledgeCollection,
  RAGDebugTrace,
  TestResult,
} from '../types/knowledge';

export function useKnowledge() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [collections, setCollections] = useState<KnowledgeCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [stats, setStats] = useState<KnowledgeStats>({
    totalSources: 0,
    totalChunks: 0,
    totalSizeBytes: 0,
    activeSources: 0,
    totalCollections: 0,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [debugTrace, setDebugTrace] = useState<RAGDebugTrace | null>(null);
  const [debugging, setDebugging] = useState(false);
  const [sanityResult, setSanityResult] = useState<TestResult | null>(null);
  const [testingSanity, setTestingSanity] = useState(false);
  const [negativeResult, setNegativeResult] = useState<TestResult | null>(null);
  const [testingNegative, setTestingNegative] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadSources = useCallback(async () => {
    try {
      const data = await api.getKnowledgeSources();
      setSources(data.sources);
      setStats(data.stats);
      if (data.collections) {
        setCollections(data.collections);
      }
      return data;
    } catch (err) {
      console.error('Erro ao carregar fontes da base de conhecimento:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  useEffect(() => {
    const hasIndexing = sources.some(s => s.status === 'indexing');
    if (hasIndexing) {
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(() => {
          loadSources();
        }, 1500);
      }
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [sources, loadSources]);

  const uploadFile = async (file: File, collectionId?: string) => {
    setUploading(true);
    setUploadError(null);
    try {
      const created = await api.uploadKnowledgeFile(file, collectionId || selectedCollectionId || undefined);
      await loadSources();
      return created;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha no upload';
      setUploadError(msg);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const reindex = async (id: string) => {
    try {
      await api.reindexKnowledgeSource(id);
      await loadSources();
    } catch (err) {
      console.error('Erro ao reindexar fonte:', err);
    }
  };

  const toggleSource = async (id: string, enabled?: boolean) => {
    try {
      await api.toggleKnowledgeSource(id, enabled);
      await loadSources();
    } catch (err) {
      console.error('Erro ao alternar fonte:', err);
    }
  };

  const setSourceCollection = async (id: string, collectionId?: string) => {
    try {
      await api.setKnowledgeSourceCollection(id, collectionId);
      await loadSources();
    } catch (err) {
      console.error('Erro ao vincular coleção:', err);
    }
  };

  const deleteSource = async (id: string) => {
    try {
      await api.deleteKnowledgeSource(id);
      await loadSources();
    } catch (err) {
      console.error('Erro ao excluir fonte:', err);
    }
  };

  const createCollection = async (data: { name: string; description?: string; color?: string }) => {
    const created = await api.createCollection(data);
    await loadSources();
    return created;
  };

  const deleteCollection = async (id: string) => {
    await api.deleteCollection(id);
    if (selectedCollectionId === id) {
      setSelectedCollectionId(null);
    }
    await loadSources();
  };

  const ingestDirectory = async (directoryPath: string, options?: { collectionId?: string; recursive?: boolean }) => {
    const res = await api.ingestDirectory(directoryPath, {
      collectionId: options?.collectionId || selectedCollectionId || undefined,
      recursive: options?.recursive,
    });
    await loadSources();
    return res;
  };

  const testSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await api.searchKnowledge(query, 6, 0.20, selectedCollectionId || undefined);
      setSearchResults(results);
    } catch (err) {
      console.error('Erro ao buscar:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const executeDebug = async (query: string, options?: { model?: string; topK?: number; minScore?: number }) => {
    setDebugging(true);
    try {
      const trace = await api.debugRAG(query, options);
      setDebugTrace(trace);
      return trace;
    } finally {
      setDebugging(false);
    }
  };

  const runSanity = async (model?: string) => {
    setTestingSanity(true);
    try {
      const res = await api.runSanityTest(model);
      setSanityResult(res);
      await loadSources();
      return res;
    } finally {
      setTestingSanity(false);
    }
  };

  const runNegative = async (model?: string) => {
    setTestingNegative(true);
    try {
      const res = await api.runNegativeTest(model);
      setNegativeResult(res);
      return res;
    } finally {
      setTestingNegative(false);
    }
  };

  const getChunks = async (sourceId: string): Promise<KnowledgeChunk[]> => {
    return api.getKnowledgeChunks(sourceId);
  };

  const filteredSources = selectedCollectionId
    ? sources.filter(s => s.collectionId === selectedCollectionId)
    : sources;

  return {
    sources: filteredSources,
    allSources: sources,
    collections,
    selectedCollectionId,
    setSelectedCollectionId,
    stats,
    loading,
    uploading,
    uploadError,
    searchResults,
    searching,
    loadSources,
    uploadFile,
    reindex,
    toggleSource,
    setSourceCollection,
    deleteSource,
    createCollection,
    deleteCollection,
    ingestDirectory,
    testSearch,
    clearSearch: () => setSearchResults([]),
    getChunks,
    debugTrace,
    debugging,
    executeDebug,
    clearDebug: () => setDebugTrace(null),
    sanityResult,
    testingSanity,
    runSanity,
    negativeResult,
    testingNegative,
    runNegative,
  };
}
