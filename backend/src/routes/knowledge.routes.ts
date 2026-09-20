import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';
import { knowledgeController } from '../controllers/knowledge.controller.js';

export const knowledgeRouter = Router();

const tempUploadDir = path.join(env.KNOWLEDGE_DIR, 'uploads_temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

knowledgeRouter.get('/sources', (req, res) => knowledgeController.getSources(req, res));
knowledgeRouter.post('/upload', upload.single('file'), (req, res) => knowledgeController.upload(req, res));
knowledgeRouter.post('/search', (req, res) => knowledgeController.search(req, res));
knowledgeRouter.post('/sources/:id/reindex', (req, res) => knowledgeController.reindex(req, res));
knowledgeRouter.patch('/sources/:id/toggle', (req, res) => knowledgeController.toggle(req, res));
knowledgeRouter.patch('/sources/:id/collection', (req, res) => knowledgeController.setCollection(req, res));
knowledgeRouter.delete('/sources/:id', (req, res) => knowledgeController.delete(req, res));
knowledgeRouter.get('/sources/:id/chunks', (req, res) => knowledgeController.getChunks(req, res));

knowledgeRouter.post('/ingest-directory', (req, res) => knowledgeController.ingestDirectory(req, res));

knowledgeRouter.get('/collections', (req, res) => knowledgeController.getCollections(req, res));
knowledgeRouter.post('/collections', (req, res) => knowledgeController.createCollection(req, res));
knowledgeRouter.delete('/collections/:id', (req, res) => knowledgeController.deleteCollection(req, res));

knowledgeRouter.post('/debug', (req, res) => knowledgeController.debug(req, res));
knowledgeRouter.post('/sanity-test', (req, res) => knowledgeController.sanityTest(req, res));
knowledgeRouter.post('/negative-test', (req, res) => knowledgeController.negativeTest(req, res));
