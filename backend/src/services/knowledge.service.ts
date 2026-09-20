import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import { env } from '../config/env.js';
import { KnowledgeSource, KnowledgeChunk, KnowledgeStats, SourceType } from '../types/knowledge.js';
import { chunkerService, RawChunk } from './chunker.service.js';
import { vectorService } from './vector.service.js';
import { ollamaService } from './ollama.service.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export class KnowledgeService {
  private sources: KnowledgeSource[] = [];
  private sourcesFilePath: string;
  private uploadDir: string;
  private initialized = false;

  constructor() {
    this.sourcesFilePath = path.join(env.KNOWLEDGE_DIR, 'sources.json');
    this.uploadDir = path.join(env.KNOWLEDGE_DIR, 'files');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(env.KNOWLEDGE_DIR, { recursive: true });
    await fs.mkdir(this.uploadDir, { recursive: true });

    try {
      const data = await fs.readFile(this.sourcesFilePath, 'utf-8');
      this.sources = JSON.parse(data) as KnowledgeSource[];
    } catch {
      this.sources = [];
    }
    this.initialized = true;
  }

  private async persistSources(): Promise<void> {
    const tempPath = `${this.sourcesFilePath}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(this.sources, null, 2), 'utf-8');
    await fs.rename(tempPath, this.sourcesFilePath);
  }

  async listSources(): Promise<KnowledgeSource[]> {
    await this.ensureInitialized();
    return this.sources.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getStats(): Promise<KnowledgeStats> {
    await this.ensureInitialized();
    const totalChunks = await vectorService.getTotalChunks();
    const totalSizeBytes = this.sources.reduce((acc, s) => acc + s.fileSize, 0);
    const activeSources = this.sources.filter(s => s.enabled && s.status === 'indexed').length;

    return {
      totalSources: this.sources.length,
      totalChunks,
      totalSizeBytes,
      activeSources,
    };
  }

  detectType(fileName: string): SourceType {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.pdf') return 'pdf';
    if (ext === '.md' || ext === '.markdown') return 'markdown';
    if (['.c', '.cpp', '.h', '.hpp', '.asm', '.s', '.py', '.rs', '.go', '.ps1', '.sh'].includes(ext)) {
      return 'code';
    }
    return 'text';
  }

  async createAndIndexSource(
    file: { originalname: string; path: string; size: number },
    collectionId?: string
  ): Promise<KnowledgeSource> {
    await this.ensureInitialized();
    const sourceId = randomUUID();
    const type = this.detectType(file.originalname);
    const now = Date.now();

    const destPath = path.join(this.uploadDir, `${sourceId}-${file.originalname}`);
    await fs.rename(file.path, destPath);

    const source: KnowledgeSource = {
      id: sourceId,
      title: path.parse(file.originalname).name,
      fileName: file.originalname,
      type,
      filePath: destPath,
      fileSize: file.size,
      enabled: true,
      collectionId,
      status: 'pending',
      progress: 0,
      statusMessage: 'Aguardando processamento...',
      chunkCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.sources.push(source);
    await this.persistSources();

    this.processIndexPipeline(source).catch(err => {
      console.error(`Erro ao indexar fonte ${source.id}:`, err);
    });

    return source;
  }

  private async processIndexPipeline(source: KnowledgeSource): Promise<void> {
    try {
      if (!source.filePath) throw new Error('Caminho do arquivo não encontrado');

      source.statusMessage = 'Extraindo texto do documento...';
      source.progress = 10;
      await this.persistSources();

      let rawChunks: RawChunk[] = [];

      if (source.type === 'pdf') {
        const buffer = await fs.readFile(source.filePath);
        const pageTexts: Array<{ pageNumber: number; text: string }> = [];

        const pdfParseModule = require('pdf-parse');
        if (typeof pdfParseModule.PDFParse === 'function') {
          const parser = new pdfParseModule.PDFParse({ data: buffer });
          const res = await parser.getText();
          if (res && Array.isArray(res.pages)) {
            pageTexts.push(
              ...res.pages
                .map((p: any, idx: number) => ({
                  pageNumber: p.num || (idx + 1),
                  text: (p.text || '').trim(),
                }))
                .filter((p: any) => p.text.length > 20)
            );
          } else if (res && typeof res.text === 'string' && res.text.trim()) {
            pageTexts.push({ pageNumber: 1, text: res.text.trim() });
          }
          await parser.destroy();
        } else if (typeof pdfParseModule === 'function') {
          const res = await pdfParseModule(buffer);
          pageTexts.push({ pageNumber: 1, text: (res.text || '').trim() });
        } else if (pdfParseModule?.default && typeof pdfParseModule.default === 'function') {
          const res = await pdfParseModule.default(buffer);
          pageTexts.push({ pageNumber: 1, text: (res.text || '').trim() });
        } else {
          throw new Error('Nenhum parser de PDF compatível encontrado');
        }

        if (pageTexts.length === 0) {
          throw new Error('Nenhum texto pôde ser extraído deste arquivo PDF (pode conter apenas imagens digitalizadas)');
        }

        rawChunks = chunkerService.chunkPdfPages(pageTexts);
      } else {
        const textContent = await fs.readFile(source.filePath, 'utf-8');
        rawChunks = chunkerService.process(textContent, source.type, {
          filePath: source.fileName,
        });
      }

      if (rawChunks.length === 0) {
        throw new Error('Nenhum texto extraível encontrado no documento');
      }

      source.statusMessage = `Iniciando vetorização (${rawChunks.length} chunks)...`;
      source.progress = 20;
      await this.persistSources();

      const knowledgeChunks: KnowledgeChunk[] = [];
      const total = rawChunks.length;
      const BATCH_SIZE = 4;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = rawChunks.slice(i, i + BATCH_SIZE);
        const embeddings = await Promise.all(
          batch.map(raw => ollamaService.generateEmbedding(raw.text))
        );

        for (let j = 0; j < batch.length; j++) {
          const raw = batch[j];
          knowledgeChunks.push({
            id: randomUUID(),
            sourceId: source.id,
            sourceTitle: source.title,
            sourceType: source.type,
            collectionId: source.collectionId,
            pageNumber: raw.pageNumber,
            chapter: raw.chapter,
            filePath: raw.filePath,
            language: raw.language,
            startLine: raw.startLine,
            endLine: raw.endLine,
            chunkIndex: raw.chunkIndex ?? (i + j),
            text: raw.text,
            embedding: embeddings[j],
          });
        }

        const processed = Math.min(i + BATCH_SIZE, total);
        const percent = Math.round(20 + (processed / total) * 75);
        source.progress = percent;
        source.statusMessage = `Vetorizando (${processed}/${total} chunks - ${percent}%)...`;
        await this.persistSources();
      }

      source.statusMessage = 'Gravando vetores no banco local...';
      source.progress = 96;
      await this.persistSources();

      await vectorService.deleteChunksBySourceId(source.id);
      await vectorService.addChunks(knowledgeChunks);

      source.status = 'indexed';
      source.progress = 100;
      source.chunkCount = knowledgeChunks.length;
      source.statusMessage = `Indexado com sucesso (${knowledgeChunks.length} chunks)`;
      source.error = undefined;
      source.updatedAt = Date.now();
      await this.persistSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na indexação';
      source.status = 'error';
      source.error = msg;
      source.statusMessage = `Erro: ${msg}`;
      source.updatedAt = Date.now();
      await this.persistSources();
    }
  }

  async reindexSource(id: string): Promise<KnowledgeSource | null> {
    await this.ensureInitialized();
    const source = this.sources.find(s => s.id === id);
    if (!source) return null;

    source.status = 'indexing';
    source.progress = 5;
    source.statusMessage = 'Reiniciando indexação...';
    source.error = undefined;
    source.updatedAt = Date.now();
    await this.persistSources();

    this.processIndexPipeline(source).catch(err => {
      console.error(`Erro ao reindexar fonte ${id}:`, err);
    });

    return source;
  }

  async toggleSource(id: string, enabled?: boolean): Promise<KnowledgeSource | null> {
    await this.ensureInitialized();
    const source = this.sources.find(s => s.id === id);
    if (!source) return null;

    source.enabled = enabled !== undefined ? enabled : !source.enabled;
    source.updatedAt = Date.now();
    await this.persistSources();
    return source;
  }

  async deleteSource(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const index = this.sources.findIndex(s => s.id === id);
    if (index === -1) return false;

    const [deletedSource] = this.sources.splice(index, 1);
    await this.persistSources();

    await vectorService.deleteChunksBySourceId(id);

    if (deletedSource.filePath) {
      try {
        await fs.unlink(deletedSource.filePath);
      } catch {
      }
    }

    return true;
  }

  async setCollection(id: string, collectionId?: string): Promise<KnowledgeSource | null> {
    await this.ensureInitialized();
    const source = this.sources.find(s => s.id === id);
    if (!source) return null;

    source.collectionId = collectionId;
    source.updatedAt = Date.now();
    await this.persistSources();
    return source;
  }

  async ingestDirectory(
    dirPath: string,
    options: { collectionId?: string; recursive?: boolean; customIgnores?: string[] } = {}
  ): Promise<{ added: number; errors: string[] }> {
    await this.ensureInitialized();
    const defaultIgnores = new Set([
      '.git', 'node_modules', 'bin', 'obj', 'build', 'dist', 'target', 'cache',
      '.vscode', '.idea', 'tmp', 'temp', '__pycache__', '.pytest_cache'
    ]);

    if (options.customIgnores) {
      options.customIgnores.forEach(i => defaultIgnores.add(i));
    }

    const supportedExtensions = new Set([
      '.pdf', '.md', '.markdown', '.txt',
      '.c', '.cpp', '.h', '.hpp', '.cc', '.cxx',
      '.asm', '.s', '.py', '.rs', '.go', '.ps1', '.sh',
      '.json', '.yaml', '.yml', '.xml'
    ]);

    const filesToProcess: string[] = [];
    const errors: string[] = [];

    const walk = async (currentDir: string) => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (defaultIgnores.has(entry.name)) continue;
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            if (options.recursive !== false) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (supportedExtensions.has(ext)) {
              filesToProcess.push(fullPath);
            }
          }
        }
      } catch (err) {
        errors.push(`Erro ao acessar diretório ${currentDir}: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    await walk(dirPath);

    let addedCount = 0;
    const tempDir = path.join(env.KNOWLEDGE_DIR, 'uploads_temp');
    await fs.mkdir(tempDir, { recursive: true });

    for (const filePath of filesToProcess) {
      try {
        const stat = await fs.stat(filePath);
        const fileName = path.basename(filePath);
        const tempPath = path.join(tempDir, `${Date.now()}-${randomUUID().slice(0, 6)}-${fileName}`);
        await fs.copyFile(filePath, tempPath);

        await this.createAndIndexSource(
          { originalname: fileName, path: tempPath, size: stat.size },
          options.collectionId
        );
        addedCount++;
      } catch (err) {
        errors.push(`Falha ao indexar arquivo ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { added: addedCount, errors };
  }

  async getActiveSourceIds(): Promise<string[]> {
    await this.ensureInitialized();
    return this.sources
      .filter(s => s.enabled && s.status === 'indexed')
      .map(s => s.id);
  }
}

export const knowledgeService = new KnowledgeService();
