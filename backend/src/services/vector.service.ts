import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';
import { KnowledgeChunk, KnowledgeSearchResult } from '../types/knowledge.js';

export class VectorService {
  private chunks: KnowledgeChunk[] = [];
  private initialized = false;
  private filePath: string;
  private version = 0;

  constructor() {
    this.filePath = path.join(env.KNOWLEDGE_DIR, 'vectors.json');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(env.KNOWLEDGE_DIR, { recursive: true });
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      this.chunks = JSON.parse(data) as KnowledgeChunk[];
    } catch {
      this.chunks = [];
    }
    this.initialized = true;
  }

  /** Muda sempre que os chunks mudam; usado para invalidar índices derivados (BM25). */
  getVersion(): number {
    return this.version;
  }

  /**
   * Um chunk só pode ser comparado com a pergunta se foi vetorizado pelo mesmo modelo.
   * Chunks antigos (sem `embeddingModel`) valem enquanto a dimensão bater.
   */
  isCompatible(chunk: KnowledgeChunk, model: string, dimensions: number): boolean {
    if (chunk.embedding.length !== dimensions) return false;
    return !chunk.embeddingModel || chunk.embeddingModel === model;
  }

  /** Fontes cujos vetores foram gerados por outro modelo de embedding e precisam ser reindexadas. */
  async getStaleSourceIds(model: string, dimensions?: number): Promise<Set<string>> {
    await this.ensureInitialized();
    const stale = new Set<string>();
    for (const chunk of this.chunks) {
      const otherModel = chunk.embeddingModel && chunk.embeddingModel !== model;
      const otherDims = dimensions !== undefined && chunk.embedding.length !== dimensions;
      if (otherModel || otherDims) stale.add(chunk.sourceId);
    }
    return stale;
  }

  async setCollectionForSource(sourceId: string, collectionId?: string): Promise<void> {
    await this.ensureInitialized();
    let changed = false;
    for (const chunk of this.chunks) {
      if (chunk.sourceId === sourceId && chunk.collectionId !== collectionId) {
        chunk.collectionId = collectionId;
        changed = true;
      }
    }
    if (changed) await this.persist();
  }

  private async persist(): Promise<void> {
    this.version++;
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(this.chunks), 'utf-8');
    await fs.rename(tempPath, this.filePath);
  }

  async addChunks(newChunks: KnowledgeChunk[]): Promise<void> {
    await this.ensureInitialized();
    this.chunks.push(...newChunks);
    await this.persist();
  }

  async deleteChunksBySourceId(sourceId: string): Promise<number> {
    await this.ensureInitialized();
    const prevCount = this.chunks.length;
    this.chunks = this.chunks.filter(c => c.sourceId !== sourceId);
    const removed = prevCount - this.chunks.length;
    if (removed > 0) {
      await this.persist();
    }
    return removed;
  }

  async getChunksBySourceId(sourceId: string): Promise<Array<Omit<KnowledgeChunk, 'embedding'>>> {
    await this.ensureInitialized();
    return this.chunks
      .filter(c => c.sourceId === sourceId)
      .map(({ embedding: _emb, ...rest }) => rest);
  }

  async getTotalChunks(): Promise<number> {
    await this.ensureInitialized();
    return this.chunks.length;
  }

  async getAllChunks(): Promise<KnowledgeChunk[]> {
    await this.ensureInitialized();
    return this.chunks;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async search(
    queryEmbedding: number[],
    topK = 5,
    minScore = 0.25,
    filterSourceIds?: string[],
    filterCollectionId?: string
  ): Promise<KnowledgeSearchResult[]> {
    await this.ensureInitialized();

    const allowedSources = filterSourceIds ? new Set(filterSourceIds) : null;
    const candidates: KnowledgeSearchResult[] = [];

    for (const chunk of this.chunks) {
      if (chunk.embedding.length !== queryEmbedding.length) continue;
      if (chunk.embeddingModel && chunk.embeddingModel !== env.EMBEDDING_MODEL) continue;
      if (allowedSources && !allowedSources.has(chunk.sourceId)) {
        continue;
      }
      if (filterCollectionId && chunk.collectionId !== filterCollectionId) {
        continue;
      }

      const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= minScore) {
        candidates.push({
          id: chunk.id,
          sourceId: chunk.sourceId,
          sourceTitle: chunk.sourceTitle,
          sourceType: chunk.sourceType,
          collectionId: chunk.collectionId,
          pageNumber: chunk.pageNumber,
          chapter: chunk.chapter,
          filePath: chunk.filePath,
          language: chunk.language,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          score,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, topK);
  }
}

export const vectorService = new VectorService();
