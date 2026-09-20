import { env } from '../config/env.js';
import { ChatCompletionRequest, OllamaTagModel, OllamaTagsResponse } from '../types/chat.js';

export class OllamaService {
  private get baseUrl(): string {
    return env.OLLAMA_HOST.replace(/\/+$/, '');
  }

  async checkHealth(): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${this.baseUrl}/api/version`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as { version: string };
        return { connected: true, version: data.version };
      }

      return { connected: false, error: `HTTP ${response.status}: ${response.statusText}` };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return { connected: false, error: errorMsg };
    }
  }

  async listModels(): Promise<OllamaTagModel[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Falha ao listar modelos do Ollama: HTTP ${response.status}`);
    }
    const data = await response.json() as OllamaTagsResponse;
    return data.models || [];
  }

  async streamChat(
    request: ChatCompletionRequest,
    abortSignal?: AbortSignal
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        keep_alive: '60m',
        options: request.options,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro do Ollama [${response.status}]: ${errText}`);
    }

    if (!response.body) {
      throw new Error('Ollama não retornou corpo de resposta de streaming');
    }

    return response.body;
  }

  async generateEmbedding(text: string, modelOverride?: string): Promise<number[]> {
    const model = modelOverride || env.EMBEDDING_MODEL;

    try {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (res.ok) {
        const data = await res.json() as { embedding?: number[] };
        if (data.embedding && Array.isArray(data.embedding)) {
          return data.embedding;
        }
      }
    } catch {
    }

    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: text }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Falha ao gerar embedding [${res.status}]: ${err}`);
    }

    const data = await res.json() as { embeddings?: number[][] };
    if (data.embeddings && data.embeddings.length > 0) {
      return data.embeddings[0];
    }

    throw new Error('Ollama não retornou vetor de embedding válido');
  }
}

export const ollamaService = new OllamaService();
