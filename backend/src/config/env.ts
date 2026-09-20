import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '0.0.0.0',
  OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
  DATA_DIR: process.env.DATA_DIR || path.resolve(__dirname, '../../data/conversations'),
  KNOWLEDGE_DIR: process.env.KNOWLEDGE_DIR || path.resolve(__dirname, '../../data/knowledge'),
  PROJECTS_DIR: process.env.PROJECTS_DIR || path.resolve(__dirname, '../../data/projects'),
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'all-minilm',
  IS_DEV: process.env.NODE_ENV !== 'production',
};
