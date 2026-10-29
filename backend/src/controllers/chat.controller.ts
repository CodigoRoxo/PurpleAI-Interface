import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ollamaService } from '../services/ollama.service.js';
import { storageService } from '../services/storage.service.js';
import { knowledgeService } from '../services/knowledge.service.js';
import { retrievalService } from '../services/retrieval.service.js';
import { projectService } from '../services/project.service.js';
import { env } from '../config/env.js';
import { ChatCompletionRequest, ChatMessage, ChatSourceCitation, MessageRole } from '../types/chat.js';
import { KnowledgeRoute, KnowledgeSearchResult } from '../types/knowledge.js';
import { logger } from '../services/logger.service.js';

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 3.5);
}

type PromptMessage = { role: MessageRole; content: string };

interface PruneResult {
  messages: PromptMessage[];
  pruned: boolean;
  prunedCount: number;
  originalTokens: number;
  newTokens: number;
}

function pruneMessagesToFitContext(messages: PromptMessage[], maxTokens: number): PruneResult {
  const totalTokens = messages.reduce((acc, m) => acc + estimateTokens(m.content), 0);
  if (totalTokens <= maxTokens) {
    return {
      messages,
      pruned: false,
      prunedCount: 0,
      originalTokens: totalTokens,
      newTokens: totalTokens,
    };
  }

  logger.warn('CHAT_CONTEXT', `Prompt inicial (~${totalTokens} tokens) excede o limite seguro (~${maxTokens} tokens). Iniciando poda inteligente.`);

  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  if (nonSystemMessages.length === 0) {
    return {
      messages: systemMessages,
      pruned: false,
      prunedCount: 0,
      originalTokens: totalTokens,
      newTokens: totalTokens,
    };
  }

  const lastUserMessage = nonSystemMessages[nonSystemMessages.length - 1];
  const history = nonSystemMessages.slice(0, nonSystemMessages.length - 1);

  let fixedTokens = systemMessages.reduce((acc, m) => acc + estimateTokens(m.content), 0) + estimateTokens(lastUserMessage.content);

  if (fixedTokens > maxTokens) {
    systemMessages.forEach(sys => {
      if (sys.content.length > 6000) {
        sys.content = sys.content.slice(0, 6000) + '\n\n[...trechos adicionais omitidos pelo otimizador de contexto...]';
      }
    });
    fixedTokens = systemMessages.reduce((acc, m) => acc + estimateTokens(m.content), 0) + estimateTokens(lastUserMessage.content);
  }

  const keptHistory: PromptMessage[] = [];
  let availableTokens = Math.max(500, maxTokens - fixedTokens);

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    let content = msg.content;
    let msgTokens = estimateTokens(content);

    if (msgTokens > 1200 && availableTokens > 400) {
      content = content.slice(0, 1200) + '\n\n[...código da resposta anterior omitido para economizar contexto...]';
      msgTokens = estimateTokens(content);
    }

    if (msgTokens <= availableTokens) {
      keptHistory.unshift({ ...msg, content });
      availableTokens -= msgTokens;
    } else {
      break;
    }
  }

  const prunedCount = history.length - keptHistory.length;
  const noticeMessage: PromptMessage[] = prunedCount > 0 ? [{
    role: 'system',
    content: `[AVISO DE SISTEMA: O histórico atingiu o limite de contexto do modelo. As ${prunedCount} mensagens mais antigas do início da conversa foram descartadas. Responda à mensagem atual utilizando o contexto mais recente disponível.]`
  }] : [];

  const result = [...systemMessages, ...noticeMessage, ...keptHistory, lastUserMessage];
  const newTotal = result.reduce((acc, m) => acc + estimateTokens(m.content), 0);
  logger.info('CHAT_CONTEXT', `Contexto ajustado: de ~${totalTokens} para ~${newTotal} tokens (${keptHistory.length}/${history.length} mensagens no histórico, ${prunedCount} podadas).`);

  return {
    messages: result,
    pruned: prunedCount > 0,
    prunedCount,
    originalTokens: totalTokens,
    newTokens: newTotal,
  };
}

export class ChatController {
  async stream(req: Request, res: Response): Promise<void> {
    const { model, messages, conversationId, options } = req.body as ChatCompletionRequest;

    if (!model || !messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Os campos "model" e "messages" são obrigatórios' });
      return;
    }

    req.socket?.setNoDelay(true);
    res.socket?.setNoDelay(true);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abortController = new AbortController();

    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    let fullAssistantResponse = '';
    const lastUserMessage = messages[messages.length - 1];

    if (conversationId && lastUserMessage.role === 'user') {
      storageService.getConversation(conversationId).then(async conv => {
        if (!conv) {
          const firstLine = lastUserMessage.content.split('\n')[0].trim();
          const autoTitle = firstLine.slice(0, 40) + (firstLine.length > 40 ? '...' : '');
          await storageService.createConversation({
            id: conversationId,
            title: autoTitle || 'Nova Conversa',
            model,
          });
        }
        await storageService.addMessage(conversationId, {
          id: randomUUID(),
          role: 'user',
          content: lastUserMessage.content,
          timestamp: Date.now(),
        });
      }).catch(err => {
        console.error('Erro ao persistir mensagem do usuário:', err);
      });
    }

    let citations: ChatSourceCitation[] = [];
    let effectiveMessages = [...messages];
    let queryEmbedding: number[] | undefined;
    let knowledgeRoute: KnowledgeRoute | undefined;

    if (req.body.useKnowledge !== false && lastUserMessage.role === 'user') {
      try {
        const querySnippet = lastUserMessage.content.slice(0, 70);
        logger.rag('QUERY_RECEIVED', `Pergunta: "${querySnippet}${lastUserMessage.content.length > 70 ? '...' : ''}"`);

        const activeSourceIds = req.body.selectedSourceIds || await knowledgeService.getActiveSourceIds();
        if (activeSourceIds.length > 0) {
          const t0 = Date.now();
          const retrieval = await retrievalService.retrieve({
            query: lastUserMessage.content,
            topK: 4,
            minScore: 0.20,
            sourceIds: activeSourceIds,
            manualCollectionIds: req.body.knowledgeCollectionIds,
          });
          queryEmbedding = retrieval.queryEmbedding;
          knowledgeRoute = retrieval.route;
          const retrieved = retrieval.results;
          const searchLatency = Date.now() - t0;

          const routeNames = retrieval.route.selected.map(c => c.name).join(', ') || '(nenhuma)';
          logger.rag('ROUTE', `Rota ${retrieval.route.mode === 'auto' ? 'automática' : 'manual'}: ${routeNames} (${retrieval.chunksEvaluated} chunks avaliados)`);
          res.write(`data: ${JSON.stringify({ type: 'knowledge_route', route: retrieval.route })}\n\n`);

          if (retrieved.length > 0) {
            const topScore = retrieved[0].score;
            logger.rag('RETRIEVAL_DONE', `Recuperados ${retrieved.length} chunks em ${searchLatency}ms (top score: ${(topScore * 100).toFixed(1)}%)`);

            citations = retrieved.map((r: KnowledgeSearchResult) => ({
              id: r.id,
              sourceId: r.sourceId,
              sourceTitle: r.sourceTitle,
              sourceType: r.sourceType,
              pageNumber: r.pageNumber,
              chapter: r.chapter,
              filePath: r.filePath,
              language: r.language,
              startLine: r.startLine,
              endLine: r.endLine,
              chunkIndex: r.chunkIndex,
              text: r.text,
              score: Math.round(r.score * 100) / 100,
            }));

            const contextText = retrieved.map((chunk: KnowledgeSearchResult, idx: number) => {
              const metaParts: string[] = [];
              if (chunk.pageNumber) metaParts.push(`Página ${chunk.pageNumber}`);
              if (chunk.chapter) metaParts.push(`Tópico/Capítulo: "${chunk.chapter}"`);
              if (chunk.filePath) metaParts.push(`Arquivo: ${chunk.filePath}`);
              if (chunk.language) metaParts.push(`Linguagem: ${chunk.language}`);
              if (chunk.startLine && chunk.endLine) metaParts.push(`Linhas ${chunk.startLine}-${chunk.endLine}`);
              const metaStr = metaParts.length > 0 ? ` (${metaParts.join(' | ')})` : '';

              return `[FONTE ${idx + 1}: ${chunk.sourceTitle}${metaStr} | Score: ${(chunk.score * 100).toFixed(1)}%]\n${chunk.text}`;
            }).join('\n\n---\n\n');

            const estimatedTokens = Math.ceil(contextText.length / 4);
            logger.rag('CONTEXT_ASSEMBLED', `Contexto montado: ${retrieved.length} chunks (~${estimatedTokens} tokens)`);

            const knowledgeInstruction = 
              `[DIRETIVA DE SISTEMA — BASE DE CONHECIMENTO TÉCNICA ATIVA]\n` +
              `Você é o assistente inteligente do PurpleAI.\n` +
              `O usuário enviou uma mensagem e o backend recuperou fragmentos relevantes da Base de Conhecimento Local.\n\n` +
              `DIRETRIZES DE FIDELIDADE:\n` +
              `1. O conteúdo dentro das tags <contexto_recuperado> consiste em dados de referência factual.\n` +
              `2. Se a resposta constar nos trechos fornecidos, responda com base neles e mencione o arquivo/documento de referência.\n` +
              `3. Se os trechos não contiverem informação suficiente, declare que a informação não consta na base recuperada e complemente com seu conhecimento geral de forma clara.\n\n` +
              `<contexto_recuperado>\n${contextText}\n</contexto_recuperado>`;

            effectiveMessages = [
              { role: 'system', content: knowledgeInstruction },
              ...effectiveMessages,
            ];
          } else {
            logger.rag('RETRIEVAL_EMPTY', `Nenhum chunk relevante nas coleções roteadas`);
          }
        }
      } catch (ragErr) {
        logger.error('RAG_ERROR', 'Falha na recuperação de conhecimento:', ragErr);
      }
    }

    if (req.body.projectId && lastUserMessage.role === 'user') {
      try {
        const project = await projectService.getProject(req.body.projectId);
        if (project) {
          logger.info('PROJECT_CHAT', `Contextualizando com o projeto "${project.name}" (${project.id})`);
          queryEmbedding ??= await ollamaService.generateEmbedding(lastUserMessage.content);
          const projectChunks = await projectService.search(project.id, queryEmbedding, 8, 0.15);
          const fileList = await projectService.getProjectFileList(project.id, 60);

          const projectCitations: ChatSourceCitation[] = projectChunks.map(c => ({
            id: c.id,
            sourceId: project.id,
            sourceTitle: `${project.name}: ${c.filePath}`,
            sourceType: 'code',
            filePath: c.filePath,
            language: c.language,
            startLine: c.startLine,
            endLine: c.endLine,
            chunkIndex: c.chunkIndex,
            text: c.text,
            score: Math.round(c.score * 100) / 100,
          }));

          citations = [...citations, ...projectCitations];

          const codeContextText = projectChunks.map((chunk, idx) => {
            return `[ARQUIVO ${idx + 1}: ${chunk.filePath} (Linhas ${chunk.startLine}-${chunk.endLine}) | Relevância: ${(chunk.score * 100).toFixed(1)}%]\n${chunk.text}`;
          }).join('\n\n---\n\n');

          const filesMap = fileList.length > 0
            ? `Árvore de arquivos do projeto:\n${fileList.map(f => `  - ${f}`).join('\n')}`
            : 'Nenhum arquivo listado.';

          const projectInstruction =
            `[DIRETIVA DE PROJETO — WORKSPACE ATIVO: "${project.name}"]\n` +
            `Diretório raiz do projeto: ${project.path}\n\n` +
            `${filesMap}\n\n` +
            (codeContextText ? `<trechos_relevantes_do_projeto>\n${codeContextText}\n</trechos_relevantes_do_projeto>\n\n` : '') +
            `INSTRUÇÕES DE AGENTE DE CÓDIGO:\n` +
            `1. Você tem visão do projeto acima. Use os trechos de código e a estrutura fornecida para entender o contexto e propor melhorias ou correções precisas.\n` +
            `2. FORMATO PREFERENCIAL — ARQUIVO COMPLETO ATUALIZADO (100% de estabilidade para aplicar de uma vez só):\n` +
            `   Quando sugerir alterações ou criar arquivos, SEMPRE QUE POSSÍVEL forneça o arquivo completo no formato:\n` +
            `   \`\`\`file:caminho/do/arquivo.ext\n` +
            `   // código completo atualizado do início ao fim sem omitir partes\n` +
            `   \`\`\`\n` +
            `3. MODIFICAÇÃO CIRÚRGICA OPCIONAL (apenas para arquivos gigantes com alteração em poucas linhas):\n` +
            `   \`\`\`diff:caminho/do/arquivo.ext\n` +
            `   <<<<<<< SEARCH\n` +
            `   // código original idêntico ao que existe no arquivo\n` +
            `   =======\n` +
            `   // novo código atualizado\n` +
            `   >>>>>>> REPLACE\n` +
            `   \`\`\`\n` +
            `O desenvolvedor possui botões interativos para aplicar tanto o patch cirúrgico quanto sobrescrever o arquivo de uma só vez com 1 clique.`;

          effectiveMessages = [
            { role: 'system', content: projectInstruction },
            ...effectiveMessages,
          ];
        }
      } catch (projErr) {
        logger.error('PROJECT_CHAT_ERROR', 'Falha ao recuperar contexto do projeto:', projErr);
      }
    }

    if (citations.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'knowledge', sources: citations })}\n\n`);
    }

    try {
      const targetCtx = options?.num_ctx || env.OLLAMA_NUM_CTX || 16384;
      const effectiveOptions = { num_ctx: targetCtx, ...options };
      const maxPromptTokens = Math.max(2048, targetCtx - 2048);

      let pruneInfo = pruneMessagesToFitContext(effectiveMessages, maxPromptTokens);
      let promptMessages = pruneInfo.messages;

      if (pruneInfo.pruned) {
        res.write(`data: ${JSON.stringify({
          type: 'context_pruned',
          prunedCount: pruneInfo.prunedCount,
          originalTokens: pruneInfo.originalTokens,
          newTokens: pruneInfo.newTokens,
          message: `Atenção: A conversa atingiu o limite de contexto (~${pruneInfo.originalTokens} tokens). ${pruneInfo.prunedCount} mensagem(ns) mais antigas do início foram descartadas para continuar sem travamentos.`
        })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({
        type: 'context_usage',
        promptTokens: pruneInfo.newTokens,
        completionTokens: 0,
        totalTokens: pruneInfo.newTokens,
        maxTokens: targetCtx,
        percentage: Math.min(100, Math.round((pruneInfo.newTokens / targetCtx) * 100)),
      })}\n\n`);

      logger.rag('STREAM_START', `Enviando requisição ao Ollama [Modelo: ${model}, num_ctx: ${targetCtx}]`);
      let stream: ReadableStream<Uint8Array>;

      try {
        stream = await ollamaService.streamChat(
          { model, messages: promptMessages, options: effectiveOptions },
          abortController.signal
        );
      } catch (streamErr: unknown) {
        const errString = streamErr instanceof Error ? streamErr.message : String(streamErr);
        if (errString.includes('exceed_context_size_error') || errString.includes('exceeds the available context size')) {
          logger.warn('STREAM_RETRY', `Ollama reportou estouro de contexto (${errString}). Executando poda emergencial e retentando...`);
          const emergencyTokens = Math.max(1500, Math.floor(maxPromptTokens * 0.5));
          pruneInfo = pruneMessagesToFitContext(effectiveMessages, emergencyTokens);
          promptMessages = pruneInfo.messages;
          if (pruneInfo.pruned) {
            res.write(`data: ${JSON.stringify({
              type: 'context_pruned',
              prunedCount: pruneInfo.prunedCount,
              originalTokens: pruneInfo.originalTokens,
              newTokens: pruneInfo.newTokens,
              message: `Atenção: A conversa atingiu o limite de contexto (~${pruneInfo.originalTokens} tokens). ${pruneInfo.prunedCount} mensagem(ns) mais antigas do início foram descartadas para prosseguir.`
            })}\n\n`);
          }
          res.write(`data: ${JSON.stringify({
            type: 'context_usage',
            promptTokens: pruneInfo.newTokens,
            completionTokens: 0,
            totalTokens: pruneInfo.newTokens,
            maxTokens: targetCtx,
            percentage: Math.min(100, Math.round((pruneInfo.newTokens / targetCtx) * 100)),
          })}\n\n`);
          stream = await ollamaService.streamChat(
            { model, messages: promptMessages, options: effectiveOptions },
            abortController.signal
          );
        } else {
          throw streamErr;
        }
      }

      const reader = stream.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let promptEvalCount: number | null = null;
      let evalCount: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed) as {
              message?: { content: string };
              done?: boolean;
              done_reason?: string;
              error?: string;
              prompt_eval_count?: number;
              eval_count?: number;
            };

            if (parsed.error) {
              res.write(`data: ${JSON.stringify({ error: parsed.error })}\n\n`);
              continue;
            }

            if (typeof parsed.prompt_eval_count === 'number') {
              promptEvalCount = parsed.prompt_eval_count;
            }
            if (typeof parsed.eval_count === 'number') {
              evalCount = parsed.eval_count;
            }

            const chunkContent = parsed.message?.content || '';
            if (chunkContent) {
              fullAssistantResponse += chunkContent;
              res.write(`data: ${JSON.stringify({ content: chunkContent, done: false })}\n\n`);
            }

            if (parsed.done) {
              const pTokens = promptEvalCount ?? pruneInfo.newTokens;
              const cTokens = evalCount ?? Math.ceil(fullAssistantResponse.length / 3.5);
              const total = pTokens + cTokens;

              res.write(`data: ${JSON.stringify({
                type: 'context_usage',
                promptTokens: pTokens,
                completionTokens: cTokens,
                totalTokens: total,
                maxTokens: targetCtx,
                percentage: Math.min(100, Math.round((total / targetCtx) * 100)),
              })}\n\n`);

              res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
            }
          } catch {
          }
        }
      }

      if (conversationId && fullAssistantResponse.trim()) {
        const pTokens = promptEvalCount ?? pruneInfo.newTokens;
        const cTokens = evalCount ?? Math.ceil(fullAssistantResponse.length / 3.5);
        const total = pTokens + cTokens;

        await storageService.addMessage(conversationId, {
          id: randomUUID(),
          role: 'assistant',
          content: fullAssistantResponse,
          timestamp: Date.now(),
          sources: citations.length > 0 ? citations : undefined,
          knowledgeRoute,
          contextPruned: pruneInfo.pruned ? {
            prunedCount: pruneInfo.prunedCount,
            originalTokens: pruneInfo.originalTokens,
            newTokens: pruneInfo.newTokens,
            message: `Contexto otimizado: ${pruneInfo.prunedCount} mensagem(ns) antigas do início da conversa foram descartadas para respeitar o limite de tokens.`
          } : undefined,
          contextUsage: {
            promptTokens: pTokens,
            completionTokens: cTokens,
            totalTokens: total,
            maxTokens: targetCtx,
            percentage: Math.min(100, Math.round((total / targetCtx) * 100)),
          },
        });
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        if (conversationId && fullAssistantResponse.trim()) {
          await storageService.addMessage(conversationId, {
            id: randomUUID(),
            role: 'assistant',
            content: fullAssistantResponse,
            timestamp: Date.now(),
            sources: citations.length > 0 ? citations : undefined,
            knowledgeRoute,
          });
        }
        res.write(`data: ${JSON.stringify({ done: true, cancelled: true })}\n\n`);
        res.end();
        return;
      }

      const errorMsg = err instanceof Error ? err.message : 'Erro durante o streaming do chat';
      res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
      res.end();
    }
  }
}

export const chatController = new ChatController();
