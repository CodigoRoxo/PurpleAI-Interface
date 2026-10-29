import { KnowledgeRoute } from './knowledge.js';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatSourceCitation {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
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

export interface ContextPrunedInfo {
  prunedCount: number;
  originalTokens: number;
  newTokens: number;
  message?: string;
}

export interface ContextUsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  maxTokens: number;
  percentage: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  sources?: ChatSourceCitation[];
  knowledgeRoute?: KnowledgeRoute;
  contextPruned?: ContextPrunedInfo;
  contextUsage?: ContextUsageInfo;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: MessageRole;
    content: string;
  }>;
  conversationId?: string;
  useKnowledge?: boolean;
  selectedSourceIds?: string[];
  /** Coleções escolhidas manualmente; vazio/ausente = roteamento automático */
  knowledgeCollectionIds?: string[];
  projectId?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_ctx?: number;
    seed?: number;
  };
}

export interface OllamaTagModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaTagModel[];
}
