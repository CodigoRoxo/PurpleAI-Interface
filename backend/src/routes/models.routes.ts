import { Router } from 'express';
import { modelsController } from '../controllers/models.controller.js';

export const modelsRouter = Router();

modelsRouter.get('/status', (req, res) => modelsController.getStatus(req, res));
modelsRouter.get('/models', (req, res) => modelsController.listModels(req, res));
