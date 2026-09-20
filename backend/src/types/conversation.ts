import { ChatMessage } from './chat.js';

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

export interface CreateConversationDto {
  id?: string;
  title?: string;
  model: string;
  systemPrompt?: string;
}

export interface UpdateConversationDto {
  title?: string;
  model?: string;
  systemPrompt?: string;
}
