import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';

export const chatRouter = Router();

chatRouter.post('/stream', (req, res) => chatController.stream(req, res));
