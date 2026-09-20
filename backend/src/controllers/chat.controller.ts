import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ollamaService } from '../services/ollama.service.js';
import { storageService } from '../services/storage.service.js';
import { knowledgeService } from '../services/knowledge.service.js';
import { vectorService } from '../services/vector.service.js';
import { projectService } from '../services/project.service.js';
import { ChatCompletionRequest, ChatMessage, ChatSourceCitation } from '../types/chat.js';
import { KnowledgeSearchResult } from '../types/knowledge.js';
import { logger } from '../services/logger.service.js';

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

    if (req.body.useKnowledge !== false && lastUserMessage.role === 'user') {
      try {
        const querySnippet = lastUserMessage.content.slice(0, 70);
        logger.rag('QUERY_RECEIVED', `Pergunta: "${querySnippet}${lastUserMessage.content.length > 70 ? '...' : ''}"`);

        const activeSourceIds = req.body.selectedSourceIds || await knowledgeService.getActiveSourceIds();
        if (activeSourceIds.length > 0) {
          const t0 = Date.now();
          const queryEmbedding = await ollamaService.generateEmbedding(lastUserMessage.content);
          const embedLatency = Date.now() - t0;
          logger.rag('EMBEDDING_DONE', `Embedding gerado em ${embedLatency}ms (${queryEmbedding.length} dimensões)`);

          const t1 = Date.now();
          const retrieved = await vectorService.search(queryEmbedding, 4, 0.20, activeSourceIds);
          const searchLatency = Date.now() - t1;

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
            logger.rag('RETRIEVAL_EMPTY', `Nenhum chunk atingiu o limiar de relevância mínimo (0.20)`);
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
          const queryEmbedding = await ollamaService.generateEmbedding(lastUserMessage.content);
          const projectChunks = await projectService.search(project.id, queryEmbedding, 5, 0.15);
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
            `INSTRUÇÕES DE ASSISTENTE DE CÓDIGO:\n` +
            `1. Você tem visão do projeto acima. Use os trechos de código e a estrutura fornecida para entender o contexto e responder com alta precisão técnica.\n` +
            `2. Quando você sugerir criar, corrigir ou modificar qualquer arquivo do projeto, SEMPRE utilize o formato de bloco com o caminho relativo exato do arquivo no topo:\n` +
            `\`\`\`file:caminho/do/arquivo.ext\n` +
            `// código completo atualizado ou modificações necessárias\n` +
            `\`\`\`\n` +
            `Esse formato permite que o desenvolvedor visualize e aplique as alterações diretamente no arquivo com um clique. Mantenha o código limpo e completo.`;

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
      logger.rag('STREAM_START', `Enviando requisição ao Ollama [Modelo: ${model}]`);
      const stream = await ollamaService.streamChat(
        { model, messages: effectiveMessages, options },
        abortController.signal
      );

      const reader = stream.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

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
            };

            if (parsed.error) {
              res.write(`data: ${JSON.stringify({ error: parsed.error })}\n\n`);
              continue;
            }

            const chunkContent = parsed.message?.content || '';
            if (chunkContent) {
              fullAssistantResponse += chunkContent;
              res.write(`data: ${JSON.stringify({ content: chunkContent, done: false })}\n\n`);
            }

            if (parsed.done) {
              res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
            }
          } catch {
          }
        }
      }

      if (conversationId && fullAssistantResponse.trim()) {
        await storageService.addMessage(conversationId, {
          id: randomUUID(),
          role: 'assistant',
          content: fullAssistantResponse,
          timestamp: Date.now(),
          sources: citations.length > 0 ? citations : undefined,
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
