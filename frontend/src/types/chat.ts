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
  contextPruned?: ContextPrunedInfo;
  contextUsage?: ContextUsageInfo;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  systemPrompt?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessagePreview?: string;
}
