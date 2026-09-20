import { Request, Response } from 'express';
import { knowledgeService } from '../services/knowledge.service.js';
import { vectorService } from '../services/vector.service.js';
import { ollamaService } from '../services/ollama.service.js';
import { collectionService } from '../services/collection.service.js';
import { ragDebugService } from '../services/rag_debug.service.js';

export class KnowledgeController {
  async getSources(_req: Request, res: Response): Promise<void> {
    try {
      const sources = await knowledgeService.listSources();
      const stats = await knowledgeService.getStats();
      const collections = await collectionService.list();
      stats.totalCollections = collections.length;
      res.json({ sources, stats, collections });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao listar fontes';
      res.status(500).json({ error: msg });
    }
  }

  async upload(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Nenhum arquivo enviado' });
        return;
      }

      const collectionId = req.body.collectionId as string | undefined;

      const source = await knowledgeService.createAndIndexSource({
        originalname: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
      }, collectionId);

      res.status(201).json(source);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar upload';
      res.status(500).json({ error: msg });
    }
  }

  async reindex(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const source = await knowledgeService.reindexSource(id);
      if (!source) {
        res.status(404).json({ error: 'Fonte não encontrada' });
        return;
      }
      res.json(source);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao reindexar';
      res.status(500).json({ error: msg });
    }
  }

  async toggle(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const source = await knowledgeService.toggleSource(id, enabled);
      if (!source) {
        res.status(404).json({ error: 'Fonte não encontrada' });
        return;
      }
      res.json(source);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao alternar status';
      res.status(500).json({ error: msg });
    }
  }

  async setCollection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { collectionId } = req.body;
      const source = await knowledgeService.setCollection(id, collectionId);
      if (!source) {
        res.status(404).json({ error: 'Fonte não encontrada' });
        return;
      }
      res.json(source);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao vincular coleção';
      res.status(500).json({ error: msg });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await knowledgeService.deleteSource(id);
      if (!success) {
        res.status(404).json({ error: 'Fonte não encontrada' });
        return;
      }
      res.json({ success: true, id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir fonte';
      res.status(500).json({ error: msg });
    }
  }

  async getChunks(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const chunks = await vectorService.getChunksBySourceId(id);
      res.json({ chunks });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao obter chunks';
      res.status(500).json({ error: msg });
    }
  }

  async search(req: Request, res: Response): Promise<void> {
    try {
      const { query, topK, minScore, sourceIds, collectionId } = req.body;
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query de busca é obrigatória' });
        return;
      }

      const queryEmbedding = await ollamaService.generateEmbedding(query);
      const results = await vectorService.search(
        queryEmbedding,
        topK || 5,
        minScore || 0.25,
        sourceIds,
        collectionId
      );

      res.json({ results });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao realizar busca vetorial';
      res.status(500).json({ error: msg });
    }
  }

  async getCollections(_req: Request, res: Response): Promise<void> {
    try {
      const collections = await collectionService.list();
      res.json({ collections });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao listar coleções';
      res.status(500).json({ error: msg });
    }
  }

  async createCollection(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, color } = req.body;
      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Nome da coleção é obrigatório' });
        return;
      }
      const col = await collectionService.create({ name, description, color });
      res.status(201).json(col);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar coleção';
      res.status(500).json({ error: msg });
    }
  }

  async deleteCollection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await collectionService.delete(id);
      res.json({ success });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir coleção';
      res.status(500).json({ error: msg });
    }
  }

  async ingestDirectory(req: Request, res: Response): Promise<void> {
    try {
      const { directoryPath, collectionId, recursive, customIgnores } = req.body;
      if (!directoryPath || typeof directoryPath !== 'string') {
        res.status(400).json({ error: 'O caminho do diretório é obrigatório' });
        return;
      }

      const result = await knowledgeService.ingestDirectory(directoryPath, {
        collectionId,
        recursive: recursive !== false,
        customIgnores,
      });

      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao ingerir diretório';
      res.status(500).json({ error: msg });
    }
  }

  async debug(req: Request, res: Response): Promise<void> {
    try {
      const { query, model, topK, minScore } = req.body;
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query de teste é obrigatória' });
        return;
      }
      
      let targetModel = model;
      if (!targetModel) {
        const models = await ollamaService.listModels();
        targetModel = models.length > 0 ? models[0].name : '';
      }

      const trace = await ragDebugService.inspectPipeline(
        query,
        targetModel,
        topK || 5,
        minScore !== undefined ? minScore : 0.20
      );

      res.json(trace);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro no diagnóstico do pipeline RAG';
      res.status(500).json({ error: msg });
    }
  }

  async sanityTest(req: Request, res: Response): Promise<void> {
    try {
      const { model } = req.body;
      let targetModel = model;
      if (!targetModel) {
        const models = await ollamaService.listModels();
        targetModel = models.length > 0 ? models[0].name : '';
      }
      const result = await ragDebugService.runSanityTest(targetModel);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro no teste de sanidade';
      res.status(500).json({ error: msg });
    }
  }

  async negativeTest(req: Request, res: Response): Promise<void> {
    try {
      const { model } = req.body;
      let targetModel = model;
      if (!targetModel) {
        const models = await ollamaService.listModels();
        targetModel = models.length > 0 ? models[0].name : '';
      }
      const result = await ragDebugService.runNegativeTest(targetModel);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro no teste negativo';
      res.status(500).json({ error: msg });
    }
  }
}

export const knowledgeController = new KnowledgeController();
