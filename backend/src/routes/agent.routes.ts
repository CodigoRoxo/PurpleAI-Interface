import { Router } from 'express';
import { agentController } from '../controllers/agent.controller.js';

export const agentRouter = Router();

agentRouter.get('/sessions', (req, res) => agentController.list(req, res));
agentRouter.post('/sessions', (req, res) => agentController.create(req, res));
agentRouter.get('/sessions/:id', (req, res) => agentController.get(req, res));
agentRouter.delete('/sessions/:id', (req, res) => agentController.delete(req, res));
agentRouter.post('/sessions/:id/run', (req, res) => agentController.run(req, res));
agentRouter.post('/sessions/:id/stop', (req, res) => agentController.stop(req, res));
agentRouter.post('/sessions/:id/revert', (req, res) => agentController.revert(req, res));
