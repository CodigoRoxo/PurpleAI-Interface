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
  score: number;
}

export interface KnowledgeStats {
  totalSources: number;
  totalChunks: number;
  totalSizeBytes: number;
  activeSources: number;
  totalCollections?: number;
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
