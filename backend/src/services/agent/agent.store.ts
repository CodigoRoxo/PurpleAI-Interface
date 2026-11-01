import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from '../../config/env.js';
import { AgentCheckpoint, AgentSession, AgentSessionSummary } from '../../types/agent.js';

/** Persistência das sessões do agente (JSON por sessão) e dos checkpoints de arquivos. */
export class AgentStore {
  private dir = env.AGENT_DIR;

  private sessionPath(id: string): string {
    return path.join(this.dir, `${id.replace(/[^a-zA-Z0-9-_]/g, '')}.json`);
  }

  private checkpointsPath(id: string): string {
    return path.join(this.dir, `${id.replace(/[^a-zA-Z0-9-_]/g, '')}.checkpoints.json`);
  }

  private async writeAtomic(file: string, data: unknown): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = `${file}.tmp.${Date.now()}`;
    await fs.writeFile(tmp, JSON.stringify(data), 'utf-8');
    await fs.rename(tmp, file);
  }

  async create(projectId: string, model: string): Promise<AgentSession> {
    const now = Date.now();
    const session: AgentSession = {
      id: randomUUID(),
      projectId,
      title: 'Nova tarefa',
      model,
      createdAt: now,
      updatedAt: now,
      messages: [],
      timeline: [],
      fileReads: {},
    };
    await this.save(session);
    return session;
  }

  async get(id: string): Promise<AgentSession | null> {
    try {
      return JSON.parse(await fs.readFile(this.sessionPath(id), 'utf-8')) as AgentSession;
    } catch {
      return null;
    }
  }

  async save(session: AgentSession): Promise<void> {
    session.updatedAt = Date.now();
    await this.writeAtomic(this.sessionPath(session.id), session);
  }

  async list(projectId?: string): Promise<AgentSessionSummary[]> {
    await fs.mkdir(this.dir, { recursive: true });
    const files = (await fs.readdir(this.dir)).filter(f => f.endsWith('.json') && !f.endsWith('.checkpoints.json'));
    const summaries: AgentSessionSummary[] = [];
    for (const file of files) {
      try {
        const s = JSON.parse(await fs.readFile(path.join(this.dir, file), 'utf-8')) as AgentSession;
        if (projectId && s.projectId !== projectId) continue;
        summaries.push({
          id: s.id,
          projectId: s.projectId,
          title: s.title,
          model: s.model,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          steps: s.timeline.filter(t => t.kind === 'tool').length,
        });
      } catch {
        // arquivo corrompido ou em escrita; ignora
      }
    }
    return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(id: string): Promise<void> {
    await fs.rm(this.sessionPath(id), { force: true });
    await fs.rm(this.checkpointsPath(id), { force: true });
  }

  async getCheckpoints(id: string): Promise<AgentCheckpoint[]> {
    try {
      return JSON.parse(await fs.readFile(this.checkpointsPath(id), 'utf-8')) as AgentCheckpoint[];
    } catch {
      return [];
    }
  }

  async addCheckpoint(id: string, checkpoint: AgentCheckpoint): Promise<void> {
    const all = await this.getCheckpoints(id);
    all.push(checkpoint);
    await this.writeAtomic(this.checkpointsPath(id), all);
  }

  async setCheckpoints(id: string, checkpoints: AgentCheckpoint[]): Promise<void> {
    await this.writeAtomic(this.checkpointsPath(id), checkpoints);
  }
}

export const agentStore = new AgentStore();
