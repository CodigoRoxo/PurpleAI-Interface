import { env } from '../config/env.js';
import {
  KnowledgeChunk,
  KnowledgeRoute,
  KnowledgeRouteCollection,
  KnowledgeSearchResult,
} from '../types/knowledge.js';
import { Bm25Index } from './lexical.service.js';
import { vectorService } from './vector.service.js';
import { knowledgeService } from './knowledge.service.js';
import { collectionService } from './collection.service.js';
import { ollamaService } from './ollama.service.js';

/** Quantos candidatos cada lista (vetorial e lexical) entrega para a fusão */
const CANDIDATE_POOL = 50;
/** Constante do Reciprocal Rank Fusion */
const RRF_K = 60;
/** Quantos dos melhores resultados fundidos votam na escolha das coleções */
const ROUTE_POOL = 20;
/** Uma coleção entra na rota se tiver ao menos esta fração da evidência da melhor */
const ROUTE_RATIO = 0.5;
const MAX_ROUTED_COLLECTIONS = 2;
/** Trechos com similaridade muito abaixo do melhor resultado são descartados */
const RELATIVE_SCORE_WINDOW = 0.15;
/** Os N melhores matches lexicais sempre entram (identificadores exatos) */
const LEXICAL_KEEP_RANK = 3;

/** Chave usada para fontes sem coleção (também aceita na seleção manual) */
export const NO_COLLECTION = '__none__';

export interface HybridRetrieveParams {
  query: string;
  queryEmbedding: number[];
  /** Chunks já filtrados: fontes ativas e vetorizados pelo modelo atual */
  candidates: KnowledgeChunk[];
  lexicalIndex: Bm25Index;
  collectionOf: (chunk: KnowledgeChunk) => string | undefined;
  describeCollection: (id: string | null) => { name: string; color?: string };
  topK: number;
  minScore: number;
  /** Coleções escolhidas pelo usuário; ausente/vazio = roteamento automático */
  manualCollectionIds?: string[];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Busca híbrida (vetorial + BM25, combinadas por RRF) com roteamento por coleção:
 * os melhores resultados "votam" nas coleções, e só as coleções com evidência forte
 * fornecem trechos para o contexto final.
 */
export function hybridRetrieve(params: HybridRetrieveParams): { results: KnowledgeSearchResult[]; route: KnowledgeRoute } {
  const { candidates, queryEmbedding, topK, minScore } = params;
  const byId = new Map(candidates.map(c => [c.id, c]));

  const vectorScores = new Map<string, number>();
  const vectorRanked = candidates
    .map(chunk => {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      vectorScores.set(chunk.id, score);
      return { id: chunk.id, score };
    })
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_POOL);

  const lexicalScores = params.lexicalIndex.search(params.query, id => byId.has(id));
  const lexicalRanked = [...lexicalScores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_POOL);
  const lexicalRank = new Map(lexicalRanked.map((r, idx) => [r.id, idx]));
  const bestLexical = lexicalRanked[0]?.score ?? 0;

  const fused = new Map<string, number>();
  vectorRanked.forEach((r, idx) => fused.set(r.id, (fused.get(r.id) || 0) + 1 / (RRF_K + idx + 1)));
  lexicalRanked.forEach((r, idx) => fused.set(r.id, (fused.get(r.id) || 0) + 1 / (RRF_K + idx + 1)));
  const fusedRanked = [...fused.entries()].sort((a, b) => b[1] - a[1]);

  const groupKey = (chunk: KnowledgeChunk) => params.collectionOf(chunk) || NO_COLLECTION;

  // Votação: cada coleção acumula a pontuação fundida dos seus trechos no topo do ranking
  const evidence = new Map<string, number>();
  for (const [id, score] of fusedRanked.slice(0, ROUTE_POOL)) {
    const key = groupKey(byId.get(id)!);
    evidence.set(key, (evidence.get(key) || 0) + score);
  }
  const bestEvidence = Math.max(0, ...evidence.values());
  const describe = (key: string): KnowledgeRouteCollection => {
    const id = key === NO_COLLECTION ? null : key;
    const info = params.describeCollection(id);
    const score = bestEvidence > 0 ? (evidence.get(key) || 0) / bestEvidence : 0;
    return { id, name: info.name, color: info.color, score: Math.round(score * 100) / 100 };
  };
  const considered = [...evidence.keys()]
    .map(describe)
    .sort((a, b) => b.score - a.score);

  let mode: KnowledgeRoute['mode'];
  let selectedKeys: Set<string>;
  if (params.manualCollectionIds && params.manualCollectionIds.length > 0) {
    mode = 'manual';
    selectedKeys = new Set(params.manualCollectionIds);
  } else {
    mode = 'auto';
    selectedKeys = new Set(
      [...evidence.entries()]
        .filter(([, score]) => score >= bestEvidence * ROUTE_RATIO)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_ROUTED_COLLECTIONS)
        .map(([key]) => key)
    );
  }

  const pool = fusedRanked.filter(([id]) => selectedKeys.has(groupKey(byId.get(id)!)));
  const bestVector = Math.max(0, ...pool.map(([id]) => vectorScores.get(id) || 0));

  const results: KnowledgeSearchResult[] = [];
  for (const [id, fusedScore] of pool) {
    if (results.length >= topK) break;

    const vectorScore = vectorScores.get(id) || 0;
    const lexRank = lexicalRank.get(id);
    const lexScore = lexicalScores.get(id);
    const semanticallyClose = vectorScore >= minScore && vectorScore >= bestVector - RELATIVE_SCORE_WINDOW;
    const strongExactMatch = lexRank !== undefined && lexRank < LEXICAL_KEEP_RANK && (lexScore || 0) >= bestLexical * 0.5;
    if (!semanticallyClose && !strongExactMatch) continue;

    const chunk = byId.get(id)!;
    results.push({
      id: chunk.id,
      sourceId: chunk.sourceId,
      sourceTitle: chunk.sourceTitle,
      sourceType: chunk.sourceType,
      collectionId: params.collectionOf(chunk),
      pageNumber: chunk.pageNumber,
      chapter: chunk.chapter,
      filePath: chunk.filePath,
      language: chunk.language,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      score: vectorScore,
      lexicalScore: lexScore,
      fusedScore,
    });
  }

  const selected = [...selectedKeys].map(key => considered.find(c => (c.id ?? NO_COLLECTION) === key) || describe(key));
  return { results, route: { mode, selected, considered } };
}

export interface RetrieveOptions {
  query: string;
  topK?: number;
  minScore?: number;
  /** Restringe a busca a estas fontes; padrão = todas as fontes ativas */
  sourceIds?: string[];
  manualCollectionIds?: string[];
  /** Reaproveita um embedding já calculado da pergunta */
  queryEmbedding?: number[];
}

export interface RetrieveResult {
  results: KnowledgeSearchResult[];
  route: KnowledgeRoute;
  queryEmbedding: number[];
  chunksEvaluated: number;
}

export class RetrievalService {
  private lexicalIndex: Bm25Index | null = null;
  private lexicalVersion = -1;

  private async getLexicalIndex(chunks: KnowledgeChunk[]): Promise<Bm25Index> {
    const version = vectorService.getVersion();
    if (!this.lexicalIndex || this.lexicalVersion !== version) {
      this.lexicalIndex = new Bm25Index(chunks.map(c => ({
        id: c.id,
        text: [c.sourceTitle, c.chapter, c.filePath, c.text].filter(Boolean).join('\n'),
      })));
      this.lexicalVersion = version;
    }
    return this.lexicalIndex;
  }

  async retrieve(options: RetrieveOptions): Promise<RetrieveResult> {
    const queryEmbedding = options.queryEmbedding ?? await ollamaService.generateEmbedding(options.query);
    const allChunks = await vectorService.getAllChunks();
    const lexicalIndex = await this.getLexicalIndex(allChunks);

    const sources = await knowledgeService.listSources();
    const sourceCollection = new Map(sources.map(s => [s.id, s.collectionId]));
    const allowedSources = new Set(options.sourceIds ?? await knowledgeService.getActiveSourceIds());

    const collections = await collectionService.list();
    const collectionById = new Map(collections.map(c => [c.id, c]));

    const candidates = allChunks.filter(chunk =>
      allowedSources.has(chunk.sourceId) &&
      vectorService.isCompatible(chunk, env.EMBEDDING_MODEL, queryEmbedding.length)
    );

    const { results, route } = hybridRetrieve({
      query: options.query,
      queryEmbedding,
      candidates,
      lexicalIndex,
      // A coleção vem da fonte (verdade atual), não do chunk, que pode estar desatualizado
      collectionOf: chunk => sourceCollection.has(chunk.sourceId) ? sourceCollection.get(chunk.sourceId) : chunk.collectionId,
      describeCollection: id => {
        const col = id ? collectionById.get(id) : undefined;
        return col ? { name: col.name, color: col.color } : { name: 'Sem coleção' };
      },
      topK: options.topK ?? 4,
      minScore: options.minScore ?? 0.2,
      manualCollectionIds: options.manualCollectionIds,
    });

    return { results, route, queryEmbedding, chunksEvaluated: candidates.length };
  }
}

export const retrievalService = new RetrievalService();
