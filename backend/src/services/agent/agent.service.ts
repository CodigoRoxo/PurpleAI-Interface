import { randomUUID } from 'crypto';
import { env } from '../../config/env.js';
import { AgentEvent, AgentMessage, AgentRunStatus, AgentSession, AgentToolCall, TimelineItem } from '../../types/agent.js';
import { countChanges, diffLines } from '../../utils/diff.js';
import { logger } from '../logger.service.js';
import { ollamaService } from '../ollama.service.js';
import { projectService } from '../project.service.js';
import { agentStore } from './agent.store.js';
import { AGENT_TOOLS, executeTool, ToolContext } from './tools.js';
import { ToolError, Workspace } from './workspace.js';

const MAX_STEPS = 30;
/** Quanto de cada resultado de ferramenta vai para o modelo */
const MAX_TOOL_OUTPUT_CHARS = 12_000;
/** Quanto da saída aparece na timeline da interface */
const MAX_UI_OUTPUT_CHARS = 4_000;
/** A partir desta fração do num_ctx, saídas antigas de ferramentas são encurtadas */
const CONTEXT_PRESSURE = 0.7;
const KEEP_RECENT_MESSAGES = 6;
const ELIDED_NOTICE = '[saída antiga omitida para economizar contexto; chame a ferramenta de novo se precisar]';

const TOOL_NAMES = new Set(AGENT_TOOLS.map(t => t.function.name));

export interface RunOptions {
  sessionId: string;
  message: string;
  model: string;
  /** Ativa o raciocínio separado (modelos com capacidade "thinking") */
  think?: boolean;
}

type Emit = (event: AgentEvent) => void;

const estimateTokens = (messages: AgentMessage[]) =>
  Math.ceil(messages.reduce((acc, m) => acc + m.content.length + JSON.stringify(m.tool_calls || '').length, 0) / 3.5);

function normalizeArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

/**
 * Alguns modelos (ou templates sem suporte nativo) escrevem a chamada de ferramenta como texto.
 * Aceita <tool_call>{...}</tool_call>, blocos ```json {...}``` e um JSON solto.
 */
export function parseTextToolCalls(text: string): { calls: AgentToolCall[]; rest: string } {
  const calls: AgentToolCall[] = [];
  let rest = text;

  const tryAdd = (jsonText: string, original: string): void => {
    try {
      const parsed = JSON.parse(jsonText);
      const name = parsed?.name ?? parsed?.function?.name;
      const args = parsed?.arguments ?? parsed?.parameters ?? parsed?.function?.arguments;
      if (typeof name === 'string' && TOOL_NAMES.has(name)) {
        calls.push({ function: { name, arguments: normalizeArgs(args) } });
        rest = rest.replace(original, '');
      }
    } catch {
      // não era uma chamada de ferramenta
    }
  };

  for (const match of text.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g)) tryAdd(match[1], match[0]);
  if (calls.length === 0) {
    for (const match of text.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/g)) tryAdd(match[1], match[0]);
  }
  if (calls.length === 0 && text.trim().startsWith('{')) tryAdd(text.trim(), text.trim());

  return { calls, rest: rest.trim() };
}

export class AgentService {
  private running = new Map<string, AbortController>();

  isRunning(sessionId: string): boolean {
    return this.running.has(sessionId);
  }

  stop(sessionId: string): boolean {
    const controller = this.running.get(sessionId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  private async buildSystemPrompt(projectName: string, workspace: Workspace): Promise<string> {
    const tree = (await workspace.listDir('.', 2)).split('\n').slice(0, 150).join('\n');
    return [
      `You are PurpleAI Agent, an autonomous coding agent working inside the user's project "${projectName}".`,
      `Operating system: ${process.platform === 'win32' ? 'Windows' : process.platform}. Today: ${new Date().toISOString().slice(0, 10)}.`,
      '',
      'You can inspect and change the project ONLY through the provided tools. Work in a loop: explore, read, edit, then summarize.',
      '',
      'Rules:',
      '1. Never guess file contents. Use list_dir, glob and grep to find files and read_file to read them before answering or editing.',
      '2. You MUST read a file in this session before editing it. Use edit_file for targeted changes and copy old_string exactly from the read_file output WITHOUT the line-number prefix (the number and TAB at the start of each line).',
      '3. Use write_file only to create new files or when rewriting most of a file. Always write the complete content, never placeholders such as "// rest of the code".',
      '4. When a change affects other files (imports, types, function callers), find them with grep and update them too, so the whole project stays consistent.',
      '5. Keep changes minimal and focused on the request. Do not reformat unrelated code.',
      '6. Look at each tool result before continuing. If a tool returns an error, fix the call and try again.',
      '7. When the task is done, stop calling tools and reply with a short summary of what you changed (files and why).',
      '8. If the user only asks a question, read the relevant code and answer; do not edit files.',
      '9. Always reply in the same language the user writes in.',
      '',
      'Project layout (depth 2, ignored folders omitted):',
      tree,
    ].join('\n');
  }

  /** Encurta saídas antigas de ferramentas quando o histórico se aproxima do limite de contexto. */
  private relieveContextPressure(messages: AgentMessage[]): void {
    const limit = env.OLLAMA_NUM_CTX * CONTEXT_PRESSURE;
    if (estimateTokens(messages) <= limit) return;

    const cutoff = messages.length - KEEP_RECENT_MESSAGES;
    for (let i = 0; i < cutoff && estimateTokens(messages) > limit; i++) {
      const msg = messages[i];
      if (msg.role === 'tool' && msg.content !== ELIDED_NOTICE && msg.content.length > 300) {
        msg.content = ELIDED_NOTICE;
      }
    }
    logger.info('AGENT_CONTEXT', `Histórico ajustado para ~${estimateTokens(messages)} tokens (limite ${env.OLLAMA_NUM_CTX}).`);
  }

  async run(options: RunOptions, emit: Emit): Promise<void> {
    const session = await agentStore.get(options.sessionId);
    if (!session) throw new Error('Sessão do agente não encontrada');
    if (this.running.has(session.id)) throw new Error('Esta sessão já está executando uma tarefa');

    const project = await projectService.getProject(session.projectId);
    if (!project) throw new Error('Projeto da sessão não encontrado');

    const controller = new AbortController();
    this.running.set(session.id, controller);

    const push = (item: TimelineItem) => {
      session.timeline.push(item);
      emit({ type: 'timeline', item });
    };
    const update = (item: TimelineItem) => emit({ type: 'timeline', item });

    let status: AgentRunStatus = 'completed';
    let statusMessage: string | undefined;

    try {
      const capabilities = await ollamaService.getModelCapabilities(options.model);
      if (capabilities && !capabilities.includes('tools')) {
        throw new Error(
          `O modelo "${options.model}" não suporta ferramentas (tool calling). ` +
          'Use um modelo com suporte, como qwen3, qwen2.5-coder ou llama3.1+.'
        );
      }
      const think = Boolean(options.think && capabilities?.includes('thinking'));

      const workspace = await Workspace.open(project.path, projectService.getIgnorePatterns(project));
      const ctx: ToolContext = { workspace, fileReads: session.fileReads };
      const systemPrompt = await this.buildSystemPrompt(project.name, workspace);

      if (session.messages.length === 0) {
        const firstLine = options.message.split('\n')[0].trim();
        session.title = firstLine.slice(0, 60) + (firstLine.length > 60 ? '...' : '');
      }
      session.model = options.model;
      session.messages.push({ role: 'user', content: options.message });
      push({ kind: 'user', id: randomUUID(), text: options.message, timestamp: Date.now() });
      await agentStore.save(session);

      let step = 0;
      for (; step < MAX_STEPS; step++) {
        if (controller.signal.aborted) break;

        this.relieveContextPressure(session.messages);
        const turn = await this.callModel(
          [{ role: 'system', content: systemPrompt }, ...session.messages],
          options.model,
          think,
          controller.signal,
          push,
          emit
        );

        let toolCalls = turn.toolCalls;
        let text = turn.text;
        if (toolCalls.length === 0 && text) {
          const parsed = parseTextToolCalls(text);
          if (parsed.calls.length > 0) {
            toolCalls = parsed.calls;
            text = parsed.rest;
            if (turn.textItem) {
              turn.textItem.text = text;
              update(turn.textItem);
            }
          }
        }
        if (turn.textItem && !turn.textItem.text) {
          session.timeline = session.timeline.filter(t => t !== turn.textItem);
        }

        session.messages.push({
          role: 'assistant',
          content: text,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        });

        if (toolCalls.length === 0) {
          await agentStore.save(session);
          break;
        }

        for (const call of toolCalls) {
          if (controller.signal.aborted) break;
          const name = call.function.name;
          const args = normalizeArgs(call.function.arguments);
          const result = await this.runTool(session, ctx, name, args, push, update);
          session.messages.push({ role: 'tool', tool_name: name, content: result });
        }
        await agentStore.save(session);
      }

      if (controller.signal.aborted) {
        status = 'aborted';
        statusMessage = 'Interrompido pelo usuário.';
      } else if (step >= MAX_STEPS) {
        status = 'max_steps';
        statusMessage = `Limite de ${MAX_STEPS} passos atingido. Envie "continue" para o agente seguir de onde parou.`;
      }
    } catch (err) {
      if (controller.signal.aborted) {
        status = 'aborted';
        statusMessage = 'Interrompido pelo usuário.';
      } else {
        status = 'error';
        statusMessage = err instanceof Error ? err.message : String(err);
        logger.error('AGENT', `Falha na sessão ${session.id}:`, err);
      }
    } finally {
      this.running.delete(session.id);
      push({ kind: 'status', id: randomUUID(), status, message: statusMessage, timestamp: Date.now() });
      await agentStore.save(session).catch(() => undefined);
      emit({ type: 'done', status, message: statusMessage });
    }
  }

  /** Uma chamada ao modelo em streaming: repassa texto e raciocínio ao vivo e coleta as tool calls. */
  private async callModel(
    messages: AgentMessage[],
    model: string,
    think: boolean,
    signal: AbortSignal,
    push: (item: TimelineItem) => void,
    emit: Emit
  ): Promise<{ text: string; toolCalls: AgentToolCall[]; textItem?: Extract<TimelineItem, { kind: 'assistant' }> }> {
    const stream = await ollamaService.streamChatRaw({
      model,
      messages,
      tools: AGENT_TOOLS,
      options: { num_ctx: env.OLLAMA_NUM_CTX, temperature: 0.2 },
      ...(think ? { think: true } : {}),
    }, signal);

    let textItem: Extract<TimelineItem, { kind: 'assistant' }> | undefined;
    let thinkingItem: Extract<TimelineItem, { kind: 'thinking' }> | undefined;
    const toolCalls: AgentToolCall[] = [];
    let inThinkTag = false;

    const appendThinking = (delta: string) => {
      if (!delta) return;
      if (!thinkingItem) {
        thinkingItem = { kind: 'thinking', id: randomUUID(), text: '', timestamp: Date.now() };
        push(thinkingItem);
      }
      thinkingItem.text += delta;
      emit({ type: 'delta', id: thinkingItem.id, kind: 'thinking', text: delta });
    };
    const appendText = (delta: string) => {
      if (!delta) return;
      if (!textItem) {
        textItem = { kind: 'assistant', id: randomUUID(), text: '', timestamp: Date.now() };
        push(textItem);
      }
      textItem.text += delta;
      emit({ type: 'delta', id: textItem.id, kind: 'assistant', text: delta });
    };
    // Modelos que escrevem <think>...</think> dentro do conteúdo
    const routeContent = (delta: string) => {
      let rest = delta;
      while (rest) {
        if (inThinkTag) {
          const end = rest.indexOf('</think>');
          if (end === -1) { appendThinking(rest); return; }
          appendThinking(rest.slice(0, end));
          rest = rest.slice(end + '</think>'.length);
          inThinkTag = false;
        } else {
          const start = rest.indexOf('<think>');
          if (start === -1) { appendText(rest); return; }
          appendText(rest.slice(0, start));
          rest = rest.slice(start + '<think>'.length);
          inThinkTag = true;
        }
      }
    };

    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        let chunk: {
          message?: { content?: string; thinking?: string; tool_calls?: AgentToolCall[] };
          error?: string;
        };
        try {
          chunk = JSON.parse(line);
        } catch {
          continue;
        }
        if (chunk.error) throw new Error(`Erro do Ollama: ${chunk.error}`);
        if (chunk.message?.thinking) appendThinking(chunk.message.thinking);
        if (chunk.message?.content) routeContent(chunk.message.content);
        if (chunk.message?.tool_calls?.length) toolCalls.push(...chunk.message.tool_calls);
      }
    }

    if (textItem) textItem.text = textItem.text.trim();
    return { text: textItem?.text ?? '', toolCalls, textItem };
  }

  /** Executa uma ferramenta, registra checkpoint e diff, e devolve o texto para o modelo. */
  private async runTool(
    session: AgentSession,
    ctx: ToolContext,
    name: string,
    args: Record<string, unknown>,
    push: (item: TimelineItem) => void,
    update: (item: TimelineItem) => void
  ): Promise<string> {
    const item: Extract<TimelineItem, { kind: 'tool' }> = {
      kind: 'tool',
      id: randomUUID(),
      name,
      args: summarizeArgs(args),
      status: 'running',
      summary: `${name}…`,
      timestamp: Date.now(),
    };
    push(item);

    try {
      const outcome = await executeTool(ctx, name, args);
      item.status = 'ok';
      item.summary = outcome.summary;

      if (outcome.change) {
        const diff = diffLines(outcome.change.before ?? '', outcome.change.after);
        const { added, removed } = countChanges(diff);
        item.filePath = outcome.change.path;
        item.diff = diff;
        item.added = added;
        item.removed = removed;
        item.checkpoint = true;
        item.summary += ` · +${added} −${removed}`;
        await agentStore.addCheckpoint(session.id, {
          stepId: item.id,
          path: outcome.change.path,
          content: outcome.change.before,
          timestamp: Date.now(),
        });
        projectService.reindexFile(session.projectId, outcome.change.path, outcome.change.after).catch(() => undefined);
      } else {
        item.output = outcome.output.slice(0, MAX_UI_OUTPUT_CHARS);
      }
      update(item);

      return outcome.output.length > MAX_TOOL_OUTPUT_CHARS
        ? `${outcome.output.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n[saída truncada]`
        : outcome.output;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      item.status = 'error';
      item.summary = `${name}: ${message}`;
      update(item);
      if (!(err instanceof ToolError)) logger.error('AGENT_TOOL', `Falha inesperada em ${name}:`, err);
      return `ERROR: ${message}`;
    }
  }

  /**
   * Desfaz todas as alterações de arquivos feitas a partir da etapa indicada (inclusive),
   * restaurando os arquivos na ordem inversa.
   */
  async revert(sessionId: string, stepId: string): Promise<{ files: string[] }> {
    if (this.running.has(sessionId)) throw new Error('Pare o agente antes de desfazer alterações');
    const session = await agentStore.get(sessionId);
    if (!session) throw new Error('Sessão do agente não encontrada');
    const project = await projectService.getProject(session.projectId);
    if (!project) throw new Error('Projeto da sessão não encontrado');

    const checkpoints = await agentStore.getCheckpoints(sessionId);
    const index = checkpoints.findIndex(c => c.stepId === stepId);
    if (index === -1) throw new Error('Checkpoint não encontrado (talvez já desfeito)');

    const workspace = await Workspace.open(project.path, projectService.getIgnorePatterns(project));
    const toUndo = checkpoints.slice(index).reverse();
    const files = new Set<string>();
    for (const checkpoint of toUndo) {
      await workspace.restore(checkpoint.path, checkpoint.content);
      files.add(checkpoint.path);
      delete session.fileReads[checkpoint.path];
    }
    await agentStore.setCheckpoints(sessionId, checkpoints.slice(0, index));

    const undoneSteps = new Set(toUndo.map(c => c.stepId));
    for (const item of session.timeline) {
      if (item.kind === 'tool' && undoneSteps.has(item.id)) item.reverted = true;
    }
    const fileList = [...files];
    session.timeline.push({ kind: 'revert', id: randomUUID(), toStepId: stepId, files: fileList, timestamp: Date.now() });
    session.messages.push({
      role: 'user',
      content: `[Sistema] O usuário desfez as alterações em: ${fileList.join(', ')}. Esses arquivos voltaram ao estado anterior; leia-os de novo antes de editar.`,
    });
    await agentStore.save(session);

    for (const file of fileList) {
      const restored = await workspace.readRaw(file).catch(() => null);
      projectService.reindexFile(session.projectId, file, restored ? restored.content : null).catch(() => undefined);
    }
    return { files: fileList };
  }
}

/** Evita guardar conteúdos gigantes (write_file) na timeline: mantém só um resumo dos argumentos. */
function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    out[key] = typeof value === 'string' && value.length > 300 ? `${value.slice(0, 300)}… (${value.length} caracteres)` : value;
  }
  return out;
}

export const agentService = new AgentService();
