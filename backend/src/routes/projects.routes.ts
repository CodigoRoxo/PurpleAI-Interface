import { Router } from 'express';
import { projectsController } from '../controllers/projects.controller.js';

const router = Router();

router.get('/', projectsController.list.bind(projectsController));
router.post('/', projectsController.create.bind(projectsController));
router.get('/:id', projectsController.get.bind(projectsController));
router.delete('/:id', projectsController.delete.bind(projectsController));
router.post('/:id/reindex', projectsController.reindex.bind(projectsController));
router.post('/:id/search', projectsController.search.bind(projectsController));
router.get('/:id/tree', projectsController.tree.bind(projectsController));
router.get('/:id/file', projectsController.getFile.bind(projectsController));
router.post('/:id/file', projectsController.saveFile.bind(projectsController));

export const projectsRouter = router;
