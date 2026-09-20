import { Request, Response } from 'express';
import { ollamaService } from '../services/ollama.service.js';

export class ModelsController {
  async getStatus(_req: Request, res: Response): Promise<void> {
    const health = await ollamaService.checkHealth();
    res.json(health);
  }

  async listModels(_req: Request, res: Response): Promise<void> {
    try {
      const models = await ollamaService.listModels();
      res.json({ models });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Falha ao buscar modelos';
      res.status(502).json({ error: errorMsg });
    }
  }
}

export const modelsController = new ModelsController();
