import { Request, Response } from 'express';
import { agentService } from '../services/agent/agent.service.js';
import { agentStore } from '../services/agent/agent.store.js';
import { projectService } from '../services/project.service.js';

export class AgentController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
      res.json(await agentStore.list(projectId));
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao listar sessões' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    const { projectId, model } = req.body;
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId é obrigatório' });
      return;
    }
    if (!(await projectService.getProject(projectId))) {
      res.status(404).json({ error: 'Projeto não encontrado' });
      return;
    }
    res.status(201).json(await agentStore.create(projectId, typeof model === 'string' ? model : ''));
  }

  async get(req: Request, res: Response): Promise<void> {
    const session = await agentStore.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Sessão não encontrada' });
      return;
    }
    const { messages: _messages, ...rest } = session;
    res.json({ ...rest, running: agentService.isRunning(session.id) });
  }

  async delete(req: Request, res: Response): Promise<void> {
    agentService.stop(req.params.id);
    await agentStore.delete(req.params.id);
    res.status(204).send();
  }

  async run(req: Request, res: Response): Promise<void> {
    const { message, model, think } = req.body;
    if (!message || typeof message !== 'string' || !model || typeof model !== 'string') {
      res.status(400).json({ error: 'Os campos "message" e "model" são obrigatórios' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sessionId = req.params.id;
    // Fechar a aba não interrompe o agente; ele segue e o resultado fica salvo na sessão
    const write = (data: unknown) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await agentService.run({ sessionId, message, model, think: Boolean(think) }, write);
    } catch (err: unknown) {
      write({ type: 'done', status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
    write('[DONE]');
    res.end();
  }

  async stop(req: Request, res: Response): Promise<void> {
    res.json({ stopped: agentService.stop(req.params.id) });
  }

  async revert(req: Request, res: Response): Promise<void> {
    const { stepId } = req.body;
    if (!stepId || typeof stepId !== 'string') {
      res.status(400).json({ error: 'stepId é obrigatório' });
      return;
    }
    try {
      res.json(await agentService.revert(req.params.id, stepId));
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao desfazer' });
    }
  }
}

export const agentController = new AgentController();
