import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { KnowledgeCollection } from '../types/knowledge.js';
import { logger } from './logger.service.js';

export class CollectionService {
  private collections: KnowledgeCollection[] = [];
  private filePath: string;
  private initialized = false;

  constructor() {
    this.filePath = path.join(env.KNOWLEDGE_DIR, 'collections.json');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(env.KNOWLEDGE_DIR, { recursive: true });
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      this.collections = JSON.parse(data) as KnowledgeCollection[];
    } catch {
      this.collections = [];
      await this.persist();
    }
    this.initialized = true;
  }

  private async persist(): Promise<void> {
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(this.collections, null, 2), 'utf-8');
    await fs.rename(tempPath, this.filePath);
  }

  async list(): Promise<KnowledgeCollection[]> {
    await this.ensureInitialized();
    return [...this.collections].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(id: string): Promise<KnowledgeCollection | null> {
    await this.ensureInitialized();
    return this.collections.find(c => c.id === id) || null;
  }

  async create(data: { name: string; description?: string; color?: string }): Promise<KnowledgeCollection> {
    await this.ensureInitialized();
    const newCol: KnowledgeCollection = {
      id: `col_${randomUUID().slice(0, 8)}`,
      name: data.name.trim(),
      description: data.description?.trim(),
      color: data.color || '#a855f7',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.collections.push(newCol);
    await this.persist();
    logger.info('COLLECTIONS', `Nova coleção criada: "${newCol.name}" (${newCol.id})`);
    return newCol;
  }

  async update(id: string, data: Partial<Pick<KnowledgeCollection, 'name' | 'description' | 'color'>>): Promise<KnowledgeCollection | null> {
    await this.ensureInitialized();
    const index = this.collections.findIndex(c => c.id === id);
    if (index === -1) return null;

    const current = this.collections[index];
    const updated: KnowledgeCollection = {
      ...current,
      name: data.name?.trim() ?? current.name,
      description: data.description?.trim() ?? current.description,
      color: data.color ?? current.color,
      updatedAt: Date.now(),
    };

    this.collections[index] = updated;
    await this.persist();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const initialLen = this.collections.length;
    this.collections = this.collections.filter(c => c.id !== id);
    if (this.collections.length < initialLen) {
      await this.persist();
      logger.info('COLLECTIONS', `Coleção excluída: ${id}`);
      return true;
    }
    return false;
  }
}

export const collectionService = new CollectionService();
