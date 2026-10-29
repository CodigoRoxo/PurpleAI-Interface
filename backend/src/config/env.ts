import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1'];

function parseList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

const HOST = process.env.HOST || '127.0.0.1';
const IS_LOOPBACK = LOOPBACK_HOSTS.includes(HOST);

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST,
  IS_LOOPBACK,
  OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
  DATA_DIR: process.env.DATA_DIR || path.resolve(__dirname, '../../data/conversations'),
  KNOWLEDGE_DIR: process.env.KNOWLEDGE_DIR || path.resolve(__dirname, '../../data/knowledge'),
  PROJECTS_DIR: process.env.PROJECTS_DIR || path.resolve(__dirname, '../../data/projects'),
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'all-minilm',
  OLLAMA_NUM_CTX: parseInt(process.env.OLLAMA_NUM_CTX || '16384', 10),
  IS_DEV: process.env.NODE_ENV !== 'production',

  // Origens do navegador autorizadas a chamar a API (frontend Vite por padrão)
  ALLOWED_ORIGINS: parseList(process.env.ALLOWED_ORIGINS, [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]),
  // Hostnames aceitos no header Host (proteção contra DNS rebinding)
  ALLOWED_HOSTS: parseList(process.env.ALLOWED_HOSTS, LOOPBACK_HOSTS),
  // Token obrigatório quando a API é exposta fora do loopback
  API_TOKEN: process.env.PURPLEAI_API_TOKEN || '',
  // Execução de comandos de terminal nos projetos (desligada por padrão fora do loopback)
  ALLOW_SHELL_COMMANDS: process.env.ALLOW_SHELL_COMMANDS
    ? process.env.ALLOW_SHELL_COMMANDS === 'true'
    : IS_LOOPBACK,
};
