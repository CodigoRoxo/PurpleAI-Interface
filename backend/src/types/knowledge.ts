export type SourceType = 'pdf' | 'markdown' | 'text' | 'code' | 'directory';
export type SourceStatus = 'pending' | 'indexing' | 'indexed' | 'error';

export interface KnowledgeCollection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  type: SourceType;
  fileName: string;
  filePath?: string;
  collectionId?: string;
  fileSize: number;
  chunkCount: number;
  status: SourceStatus;
  progress: number;
  statusMessage?: string;
  error?: string;
  enabled: boolean;
  embeddingModel?: string;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeChunk {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: SourceType;
  collectionId?: string;
  pageNumber?: number;
  chapter?: string;
  filePath?: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  chunkIndex: number;
  text: string;
  embedding: number[];
  embeddingModel?: string;
}

export interface KnowledgeSearchResult {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: SourceType;
  collectionId?: string;
  pageNumber?: number;
  chapter?: string;
  filePath?: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  chunkIndex?: number;
  text: string;
  /** Similaridade de cosseno com a pergunta (0-1) */
  score: number;
  /** Pontuação BM25 (busca por palavras), quando houve match lexical */
  lexicalScore?: number;
  /** Pontuação combinada (Reciprocal Rank Fusion) usada para ordenar */
  fusedScore?: number;
}

export interface KnowledgeRouteCollection {
  /** null = fontes sem coleção */
  id: string | null;
  name: string;
  color?: string;
  score: number;
}

export interface KnowledgeRoute {
  mode: 'auto' | 'manual';
  selected: KnowledgeRouteCollection[];
  considered: KnowledgeRouteCollection[];
}

export interface EmbeddingStatus {
  model: string;
  installed: boolean;
  dimensions?: number;
  error?: string;
  staleSources: number;
}

export interface KnowledgeStats {
  totalSources: number;
  totalChunks: number;
  totalSizeBytes: number;
  activeSources: number;
  totalCollections?: number;
  embedding?: EmbeddingStatus;
}

export interface RAGDebugChunk extends KnowledgeSearchResult {
  rank: number;
  characterCount: number;
  estimatedTokens: number;
}

export interface RAGDebugTrace {
  query: string;
  timestamp: number;
  embedding: {
    dimensions: number;
    latencyMs: number;
    sample: number[];
  };
  retrieval: {
    totalChunksIndexed: number;
    chunksEvaluated: number;
    minScoreThreshold: number;
    latencyMs: number;
    chunks: RAGDebugChunk[];
    route?: KnowledgeRoute;
  };
  prompt: {
    systemDirective: string;
    assembledContext: string;
    finalMessages: Array<{ role: string; content: string }>;
    estimatedContextTokens: number;
  };
  generation?: {
    model: string;
    latencyMs: number;
    response: string;
  };
}
