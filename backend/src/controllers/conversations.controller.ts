import { Request, Response } from 'express';
import { storageService } from '../services/storage.service.js';

export class ConversationsController {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const conversations = await storageService.listConversations();
      res.json({ conversations });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao listar conversas';
      res.status(500).json({ error: msg });
    }
  }

  async getOne(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const conversation = await storageService.getConversation(id);
      if (!conversation) {
        res.status(404).json({ error: 'Conversa não encontrada' });
        return;
      }
      res.json(conversation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar conversa';
      res.status(500).json({ error: msg });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { title, model, systemPrompt } = req.body;
      if (!model) {
        res.status(400).json({ error: 'O campo "model" é obrigatório' });
        return;
      }

      const conversation = await storageService.createConversation({
        title,
        model,
        systemPrompt,
      });
      res.status(201).json(conversation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conversa';
      res.status(500).json({ error: msg });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, model, systemPrompt } = req.body;

      const updated = await storageService.updateConversation(id, {
        title,
        model,
        systemPrompt,
      });

      if (!updated) {
        res.status(404).json({ error: 'Conversa não encontrada' });
        return;
      }

      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar conversa';
      res.status(500).json({ error: msg });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await storageService.deleteConversation(id);

      if (!deleted) {
        res.status(404).json({ error: 'Conversa não encontrada' });
        return;
      }

      res.json({ success: true, id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir conversa';
      res.status(500).json({ error: msg });
    }
  }
}

export const conversationsController = new ConversationsController();
