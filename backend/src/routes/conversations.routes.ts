import { Router } from 'express';
import { conversationsController } from '../controllers/conversations.controller.js';

export const conversationsRouter = Router();

conversationsRouter.get('/', (req, res) => conversationsController.list(req, res));
conversationsRouter.post('/', (req, res) => conversationsController.create(req, res));
conversationsRouter.get('/:id', (req, res) => conversationsController.getOne(req, res));
conversationsRouter.patch('/:id', (req, res) => conversationsController.update(req, res));
conversationsRouter.delete('/:id', (req, res) => conversationsController.delete(req, res));
