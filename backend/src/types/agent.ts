import { DiffLine } from '../utils/diff.js';

export interface AgentToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/** Mensagem no formato da API /api/chat do Ollama */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: AgentToolCall[];
  tool_name?: string;
  thinking?: string;
}

export type AgentRunStatus = 'completed' | 'max_steps' | 'aborted' | 'error';

interface TimelineBase {
  id: string;
  timestamp: number;
}

export type TimelineItem =
  | (TimelineBase & { kind: 'user'; text: string })
  | (TimelineBase & { kind: 'assistant'; text: string })
  | (TimelineBase & { kind: 'thinking'; text: string })
  | (TimelineBase & {
      kind: 'tool';
      name: string;
      args: Record<string, unknown>;
      status: 'running' | 'ok' | 'error';
      summary: string;
      output?: string;
      filePath?: string;
      diff?: DiffLine[];
      added?: number;
      removed?: number;
      /** Esta etapa alterou arquivos e pode ser desfeita */
      checkpoint?: boolean;
      reverted?: boolean;
    })
  | (TimelineBase & { kind: 'status'; status: AgentRunStatus; message?: string })
  | (TimelineBase & { kind: 'revert'; toStepId: string; files: string[] });

export interface AgentSession {
  id: string;
  projectId: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messages: AgentMessage[];
  timeline: TimelineItem[];
  /** Arquivo -> mtime da última leitura; edições exigem leitura prévia e atual */
  fileReads: Record<string, number>;
}

export interface AgentSessionSummary {
  id: string;
  projectId: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  steps: number;
}

export interface AgentCheckpoint {
  stepId: string;
  path: string;
  /** Conteúdo antes da etapa; null = o arquivo não existia */
  content: string | null;
  timestamp: number;
}

export type AgentEvent =
  | { type: 'timeline'; item: TimelineItem }
  | { type: 'delta'; id: string; kind: 'assistant' | 'thinking'; text: string }
  | { type: 'done'; status: AgentRunStatus; message?: string };
