import { Conversation, ConversationSummary, ChatSourceCitation } from '../types/chat';
import { OllamaModel, OllamaStatus } from '../types/model';
import { KnowledgeSource, KnowledgeStats, KnowledgeChunk, KnowledgeSearchResult, KnowledgeCollection, RAGDebugTrace, TestResult } from '../types/knowledge';
import { Project, ProjectSearchResult, ProjectTreeNode } from '../types/project';

const API_BASE = '/api';

export const api = {
  async getProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async getProject(id: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${id}`);
    if (!res.ok) throw new Error('Project not found');
    return res.json();
  },

  async createProject(name: string, path: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create project');
    }
    return res.json();
  },

  async deleteProject(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete project');
  },

  async reindexProject(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${id}/reindex`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reindex project');
    }
  },

  async searchProject(id: string, query: string, topK = 10, threshold = 0.1): Promise<ProjectSearchResult[]> {
    const res = await fetch(`${API_BASE}/projects/${id}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK, threshold }),
    });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async getProjectTree(id: string): Promise<ProjectTreeNode[]> {
    const res = await fetch(`${API_BASE}/projects/${id}/tree`);
    if (!res.ok) throw new Error('Falha ao obter árvore de arquivos do projeto');
    return res.json();
  },

  async getProjectFile(id: string, filePath: string): Promise<{ content: string; language: string; size: number }> {
    const res = await fetch(`${API_BASE}/projects/${id}/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error('Falha ao carregar arquivo do projeto');
    return res.json();
  },

  async saveProjectFile(
    id: string,
    filePath: string,
    content: string
  ): Promise<{ success: boolean; backupCreated: boolean; chunksCount: number }> {
    const res = await fetch(`${API_BASE}/projects/${id}/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao salvar arquivo no projeto');
    }
    return res.json();
  },

  async getOllamaStatus(): Promise<OllamaStatus> {
    const res = await fetch(`${API_BASE}/ollama/status`);
    if (!res.ok) throw new Error('Falha ao verificar status do Ollama');
    return res.json();
  },

  async getOllamaModels(): Promise<OllamaModel[]> {
    const res = await fetch(`${API_BASE}/ollama/models`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao buscar modelos do Ollama');
    }
    const data = await res.json();
    return data.models || [];
  },

  async listConversations(): Promise<ConversationSummary[]> {
    const res = await fetch(`${API_BASE}/conversations`);
    if (!res.ok) throw new Error('Falha ao listar conversas');
    const data = await res.json();
    return data.conversations || [];
  },

  async getConversation(id: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations/${id}`);
    if (!res.ok) throw new Error('Conversa não encontrada');
    return res.json();
  },

  async createConversation(payload: { id?: string; title?: string; model: string; systemPrompt?: string }): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Falha ao criar conversa');
    return res.json();
  },

  async updateConversation(id: string, payload: { title?: string; model?: string }): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Falha ao atualizar conversa');
    return res.json();
  },

  async deleteConversation(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao deletar conversa');
  },

  async getKnowledgeSources(): Promise<{ sources: KnowledgeSource[]; stats: KnowledgeStats; collections: KnowledgeCollection[] }> {
    const res = await fetch(`${API_BASE}/knowledge/sources`);
    if (!res.ok) throw new Error('Falha ao carregar fontes de conhecimento');
    return res.json();
  },

  async uploadKnowledgeFile(file: File, collectionId?: string): Promise<KnowledgeSource> {
    const formData = new FormData();
    formData.append('file', file);
    if (collectionId) {
      formData.append('collectionId', collectionId);
    }

    const res = await fetch(`${API_BASE}/knowledge/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao enviar arquivo');
    }

    return res.json();
  },

  async reindexKnowledgeSource(id: string): Promise<KnowledgeSource> {
    const res = await fetch(`${API_BASE}/knowledge/sources/${id}/reindex`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Falha ao reindexar fonte');
    return res.json();
  },

  async toggleKnowledgeSource(id: string, enabled?: boolean): Promise<KnowledgeSource> {
    const res = await fetch(`${API_BASE}/knowledge/sources/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error('Falha ao alternar fonte');
    return res.json();
  },

  async setKnowledgeSourceCollection(id: string, collectionId?: string): Promise<KnowledgeSource> {
    const res = await fetch(`${API_BASE}/knowledge/sources/${id}/collection`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId }),
    });
    if (!res.ok) throw new Error('Falha ao vincular coleção à fonte');
    return res.json();
  },

  async deleteKnowledgeSource(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/knowledge/sources/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao excluir fonte');
  },

  async getKnowledgeChunks(sourceId: string): Promise<KnowledgeChunk[]> {
    const res = await fetch(`${API_BASE}/knowledge/sources/${sourceId}/chunks`);
    if (!res.ok) throw new Error('Falha ao buscar trechos da fonte');
    const data = await res.json();
    return data.chunks || [];
  },

  async searchKnowledge(query: string, topK = 5, minScore = 0.25, collectionId?: string): Promise<KnowledgeSearchResult[]> {
    const res = await fetch(`${API_BASE}/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK, minScore, collectionId }),
    });
    if (!res.ok) throw new Error('Falha ao realizar busca');
    const data = await res.json();
    return data.results || [];
  },

  async ingestDirectory(
    directoryPath: string,
    options?: { collectionId?: string; recursive?: boolean }
  ): Promise<{ added: number; errors: string[] }> {
    const res = await fetch(`${API_BASE}/knowledge/ingest-directory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directoryPath, ...options }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao ingerir diretório');
    }
    return res.json();
  },

  async getCollections(): Promise<KnowledgeCollection[]> {
    const res = await fetch(`${API_BASE}/knowledge/collections`);
    if (!res.ok) throw new Error('Falha ao carregar coleções');
    const data = await res.json();
    return data.collections || [];
  },

  async createCollection(data: { name: string; description?: string; color?: string }): Promise<KnowledgeCollection> {
    const res = await fetch(`${API_BASE}/knowledge/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao criar coleção');
    }
    return res.json();
  },

  async deleteCollection(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/knowledge/collections/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao excluir coleção');
  },

  async debugRAG(query: string, options?: { model?: string; topK?: number; minScore?: number }): Promise<RAGDebugTrace> {
    const res = await fetch(`${API_BASE}/knowledge/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao executar diagnóstico RAG');
    }
    return res.json();
  },

  async runSanityTest(model?: string): Promise<TestResult> {
    const res = await fetch(`${API_BASE}/knowledge/sanity-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    if (!res.ok) throw new Error('Falha ao executar teste de sanidade');
    return res.json();
  },

  async runNegativeTest(model?: string): Promise<TestResult> {
    const res = await fetch(`${API_BASE}/knowledge/negative-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    if (!res.ok) throw new Error('Falha ao executar teste negativo');
    return res.json();
  },

  async streamChat({
    model,
    messages,
    conversationId,
    useKnowledge,
    selectedSourceIds,
    projectId,
    signal,
    onChunk,
    onSources,
    onDone,
    onError,
  }: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    conversationId?: string;
    useKnowledge?: boolean;
    selectedSourceIds?: string[];
    projectId?: string;
    signal?: AbortSignal;
    onChunk: (chunk: string) => void;
    onSources?: (sources: ChatSourceCitation[]) => void;
    onDone: () => void;
    onError: (err: Error) => void;
  }): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          conversationId,
          useKnowledge,
          selectedSourceIds,
          projectId,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na chamada da API [${response.status}]: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Sem fluxo de dados na resposta');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              onDone();
              return;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                onError(new Error(parsed.error));
                return;
              }

              if (parsed.type === 'knowledge' && parsed.sources && onSources) {
                onSources(parsed.sources);
                continue;
              }

              if (parsed.content) {
                onChunk(parsed.content);
              }
              if (parsed.done) {
                onDone();
                return;
              }
            } catch {
            }
          }
        }
      }

      onDone();
    } catch (err: unknown) {
      if (signal?.aborted) {
        onDone();
        return;
      }
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  },
};
