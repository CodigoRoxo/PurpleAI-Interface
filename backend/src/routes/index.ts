import { Router } from 'express';
import { modelsRouter } from './models.routes.js';
import { chatRouter } from './chat.routes.js';
import { conversationsRouter } from './conversations.routes.js';
import { knowledgeRouter } from './knowledge.routes.js';
import { projectsRouter } from './projects.routes.js';

export const apiRouter = Router();

apiRouter.use('/ollama', modelsRouter);
apiRouter.use('/chat', chatRouter);
apiRouter.use('/conversations', conversationsRouter);
apiRouter.use('/knowledge', knowledgeRouter);
apiRouter.use('/projects', projectsRouter);
