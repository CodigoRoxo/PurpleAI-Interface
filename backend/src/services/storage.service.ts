import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { Conversation, ConversationSummary, CreateConversationDto, UpdateConversationDto } from '../types/conversation.js';
import { ChatMessage } from '../types/chat.js';

export class StorageService {
  private dataDir: string;
  private initialized: boolean = false;

  constructor() {
    this.dataDir = env.DATA_DIR;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await fs.mkdir(this.dataDir, { recursive: true });
      this.initialized = true;
    }
  }

  private getFilePath(id: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '');
    return path.join(this.dataDir, `${safeId}.json`);
  }

  async listConversations(): Promise<ConversationSummary[]> {
    await this.ensureInitialized();
    const files = await fs.readdir(this.dataDir);
    const summaries: ConversationSummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await fs.readFile(path.join(this.dataDir, file), 'utf-8');
        const conv = JSON.parse(content) as Conversation;
        const lastMsg = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].content : '';

        summaries.push({
          id: conv.id,
          title: conv.title,
          model: conv.model,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          messageCount: conv.messages.length,
          lastMessagePreview: lastMsg.slice(0, 100),
        });
      } catch (err) {
        console.error(`Erro ao ler conversa do arquivo ${file}:`, err);
      }
    }

    return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    await this.ensureInitialized();
    const filePath = this.getFilePath(id);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as Conversation;
    } catch {
      return null;
    }
  }

  async createConversation(dto: CreateConversationDto): Promise<Conversation> {
    await this.ensureInitialized();
    const now = Date.now();
    const conv: Conversation = {
      id: dto.id || randomUUID(),
      title: dto.title || 'Nova Conversa',
      model: dto.model,
      createdAt: now,
      updatedAt: now,
      messages: [],
      systemPrompt: dto.systemPrompt,
    };

    await this.saveConversation(conv);
    return conv;
  }

  async saveConversation(conv: Conversation): Promise<void> {
    await this.ensureInitialized();
    conv.updatedAt = Date.now();
    const filePath = this.getFilePath(conv.id);
    const tempPath = `${filePath}.tmp.${Date.now()}`;

    await fs.writeFile(tempPath, JSON.stringify(conv, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  }

  async updateConversation(id: string, updates: UpdateConversationDto): Promise<Conversation | null> {
    const conv = await this.getConversation(id);
    if (!conv) return null;

    if (updates.title !== undefined) conv.title = updates.title.trim() || 'Sem Título';
    if (updates.model !== undefined) conv.model = updates.model;
    if (updates.systemPrompt !== undefined) conv.systemPrompt = updates.systemPrompt;

    await this.saveConversation(conv);
    return conv;
  }

  async addMessage(id: string, message: ChatMessage): Promise<Conversation | null> {
    const conv = await this.getConversation(id);
    if (!conv) return null;

    conv.messages.push(message);

    if (conv.messages.length === 1 && message.role === 'user' && conv.title === 'Nova Conversa') {
      const firstLine = message.content.split('\n')[0].trim();
      conv.title = firstLine.slice(0, 40) + (firstLine.length > 40 ? '...' : '');
    }

    await this.saveConversation(conv);
    return conv;
  }

  async deleteConversation(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const filePath = this.getFilePath(id);

    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService = new StorageService();
