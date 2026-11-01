export interface DiffLine {
  type: ' ' | '+' | '-' | '@';
  text: string;
}

export type AgentRunStatus = 'completed' | 'max_steps' | 'aborted' | 'error';

interface TimelineBase {
  id: string;
  timestamp: number;
}

export type AgentToolItem = TimelineBase & {
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
  checkpoint?: boolean;
  reverted?: boolean;
};

export type TimelineItem =
  | (TimelineBase & { kind: 'user'; text: string })
  | (TimelineBase & { kind: 'assistant'; text: string })
  | (TimelineBase & { kind: 'thinking'; text: string })
  | AgentToolItem
  | (TimelineBase & { kind: 'status'; status: AgentRunStatus; message?: string })
  | (TimelineBase & { kind: 'revert'; toStepId: string; files: string[] });

export interface AgentSession {
  id: string;
  projectId: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  timeline: TimelineItem[];
  running?: boolean;
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

export type AgentEvent =
  | { type: 'timeline'; item: TimelineItem }
  | { type: 'delta'; id: string; kind: 'assistant' | 'thinking'; text: string }
  | { type: 'done'; status: AgentRunStatus; message?: string };
