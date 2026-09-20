import { Request, Response } from 'express';
import { projectService } from '../services/project.service.js';
import { ollamaService } from '../services/ollama.service.js';

export class ProjectsController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const projects = await projectService.listProjects();
      res.json(projects);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list projects' });
    }
  }

  async get(req: Request, res: Response): Promise<void> {
    try {
      const project = await projectService.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json(project);
    } catch (err) {
      res.status(500).json({ error: 'Failed to get project' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, path } = req.body;
    if (!name || !path) {
      res.status(400).json({ error: 'Name and path are required' });
      return;
    }
    
    try {
      const project = await projectService.createProject(name, path);
      projectService.reindexProject(project.id).catch(console.error);
      res.status(201).json(project);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create project' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await projectService.deleteProject(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete project' });
    }
  }

  async reindex(req: Request, res: Response): Promise<void> {
    try {
      await projectService.reindexProject(req.params.id);
      res.status(202).json({ message: 'Reindexing started' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to reindex project' });
    }
  }

  async search(req: Request, res: Response): Promise<void> {
    const { query, topK, threshold } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    try {
      const embedding = await ollamaService.generateEmbedding(query);
      const results = await projectService.search(req.params.id, embedding, topK, threshold);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Search failed' });
    }
  }

  async tree(req: Request, res: Response): Promise<void> {
    try {
      const tree = await projectService.getProjectTree(req.params.id);
      res.json(tree);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to get project tree' });
    }
  }

  async getFile(req: Request, res: Response): Promise<void> {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: 'Path query param is required' });
      return;
    }

    try {
      const fileData = await projectService.getFileContent(req.params.id, filePath);
      res.json(fileData);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to read file' });
    }
  }

  async saveFile(req: Request, res: Response): Promise<void> {
    const { path: filePath, content } = req.body;
    if (!filePath || typeof content !== 'string') {
      res.status(400).json({ error: 'Path and content string are required' });
      return;
    }

    try {
      const result = await projectService.saveProjectFile(req.params.id, filePath, content);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save file' });
    }
  }
}

export const projectsController = new ProjectsController();
