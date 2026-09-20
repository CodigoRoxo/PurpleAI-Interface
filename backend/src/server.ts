import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));

if (env.IS_DEV) {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api', apiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]:', err);
  res.status(500).json({
    error: 'Erro interno no servidor',
    message: env.IS_DEV ? err.message : undefined,
  });
});

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`=========================================`);
  console.log(`  PurpleAI Backend rodando com sucesso!  `);
  console.log(`  URL: http://${env.HOST === '0.0.0.0' ? 'localhost' : env.HOST}:${env.PORT}`);
  console.log(`  Ollama Target: ${env.OLLAMA_HOST}`);
  console.log(`=========================================`);
});

const shutdown = () => {
  console.log('Encerrando servidor PurpleAI Backend...');
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
