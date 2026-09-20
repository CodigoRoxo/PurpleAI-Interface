import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import ignore from 'ignore';
import { env } from '../config/env.js';
import { Project, ProjectSettings, ProjectFile, ProjectSearchResult, ProjectTreeNode } from '../types/project.js';
import { chunkerService } from './chunker.service.js';
import { ollamaService } from './ollama.service.js';
import { logger } from './logger.service.js';

interface ProjectChunk {
  id: string;
  projectId: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  chunkIndex: number;
  text: string;
  embedding: number[];
}

export class ProjectService {
  private projectsFile: string;
  private projects: Project[] = [];
  private initialized = false;

  private DEFAULT_IGNORES = [
    '.git', 'node_modules', 'bin', 'obj', 'build', 'dist', 'target', 
    '.cache', '.vscode', '.idea', '*.min.js', '*.min.css', '*.map', '*.lock', 'package-lock.json'
  ];

  constructor() {
    this.projectsFile = path.join(env.PROJECTS_DIR, 'projects.json');
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    await fs.mkdir(env.PROJECTS_DIR, { recursive: true });
    try {
      const data = await fs.readFile(this.projectsFile, 'utf-8');
      this.projects = JSON.parse(data);
    } catch {
      this.projects = [];
    }
    this.initialized = true;
  }

  private async persist() {
    await fs.writeFile(this.projectsFile, JSON.stringify(this.projects, null, 2), 'utf-8');
  }

  private getVectorsFilePath(projectId: string): string {
    return path.join(env.PROJECTS_DIR, `${projectId}_vectors.json`);
  }

  async listProjects(): Promise<Project[]> {
    await this.ensureInitialized();
    return this.projects;
  }

  async getProject(id: string): Promise<Project | undefined> {
    await this.ensureInitialized();
    return this.projects.find(p => p.id === id);
  }

  async createProject(name: string, dirPath: string): Promise<Project> {
    await this.ensureInitialized();
    
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) throw new Error('Path is not a directory');
    } catch (e) {
      throw new Error(`Cannot access directory: ${dirPath}`);
    }

    const project: Project = {
      id: randomUUID(),
      name,
      path: dirPath,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'idle',
      stats: {
        totalFiles: 0,
        totalLines: 0,
        totalSizeInBytes: 0,
        indexedChunks: 0
      },
      settings: {
        ignorePatterns: [...this.DEFAULT_IGNORES]
      }
    };

    this.projects.push(project);
    await this.persist();
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    await this.ensureInitialized();
    this.projects = this.projects.filter(p => p.id !== id);
    await this.persist();
    
    try {
      await fs.unlink(this.getVectorsFilePath(id));
    } catch {}
  }

  async reindexProject(id: string): Promise<void> {
    const project = await this.getProject(id);
    if (!project) throw new Error('Project not found');

    project.status = 'indexing';
    await this.persist();

    this.indexProjectInternal(project).catch(err => {
      logger.error('PROJECT_INDEXING', `Failed to index project ${id}`, err);
      project.status = 'error';
      this.persist();
    });
  }

  private async indexProjectInternal(project: Project): Promise<void> {
    const ig = ignore().add(project.settings?.ignorePatterns || this.DEFAULT_IGNORES);
    
    const filesToProcess: string[] = [];
    
    const walk = async (dir: string, baseDir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        
        if (ig.ignores(relPath)) continue;

        if (entry.isDirectory()) {
          await walk(fullPath, baseDir);
        } else if (entry.isFile()) {
          if (chunkerService.detectLanguage(entry.name)) {
            filesToProcess.push(fullPath);
          }
        }
      }
    };

    logger.info('PROJECT_INDEXING', `Walking directory: ${project.path}`);
    await walk(project.path, project.path);
    
    const projectChunks: ProjectChunk[] = [];
    let totalFiles = 0;
    let totalLines = 0;
    let totalSize = 0;

    for (const filePath of filesToProcess) {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size > 10 * 1024 * 1024) continue;

        const content = await fs.readFile(filePath, 'utf-8');
        const relPath = path.relative(project.path, filePath).replace(/\\/g, '/');
        
        const linesCount = content.split('\n').length;
        totalFiles++;
        totalLines += linesCount;
        totalSize += stats.size;

        const chunks = chunkerService.process(content, 'code', { filePath: relPath });
        
        for (const c of chunks) {
          const embedding = await ollamaService.generateEmbedding(c.text);
          projectChunks.push({
            id: randomUUID(),
            projectId: project.id,
            filePath: relPath,
            language: c.language || 'text',
            startLine: c.startLine || 1,
            endLine: c.endLine || linesCount,
            chunkIndex: c.chunkIndex || 0,
            text: c.text,
            embedding
          });
        }
      } catch (err) {
        logger.error('PROJECT_INDEXING', `Error processing file ${filePath}:`, err);
      }
    }

    const vectorsPath = this.getVectorsFilePath(project.id);
    await fs.writeFile(vectorsPath, JSON.stringify(projectChunks), 'utf-8');

    project.stats = {
      totalFiles,
      totalLines,
      totalSizeInBytes: totalSize,
      indexedChunks: projectChunks.length
    };
    project.status = 'ready';
    project.lastIndexedAt = Date.now();
    project.updatedAt = Date.now();
    
    await this.persist();
    logger.info('PROJECT_INDEXING', `Finished indexing project ${project.id}. ${projectChunks.length} chunks generated.`);
  }

  private async loadProjectVectors(projectId: string): Promise<ProjectChunk[]> {
    try {
      const data = await fs.readFile(this.getVectorsFilePath(projectId), 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async search(projectId: string, embedding: number[], topK = 5, threshold = 0.2): Promise<ProjectSearchResult[]> {
    const chunks = await this.loadProjectVectors(projectId);
    if (!chunks.length) return [];

    const scored = chunks.map(chunk => ({
      ...chunk,
      score: this.cosineSimilarity(embedding, chunk.embedding)
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter(c => c.score >= threshold)
      .slice(0, topK)
      .map(({ embedding: _e, ...rest }) => rest);
  }

  private resolveSafePath(projectRoot: string, relativePath: string): string {
    const cleanRel = relativePath.replace(/^[/\\]+/, '');
    const resolvedRoot = path.resolve(projectRoot);
    const resolvedPath = path.resolve(projectRoot, cleanRel);
    if (!resolvedPath.startsWith(resolvedRoot)) {
      throw new Error('Acesso negado: Caminho fora do diretório raiz do projeto');
    }
    return resolvedPath;
  }

  async getProjectTree(projectId: string): Promise<ProjectTreeNode[]> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const ig = ignore().add(project.settings?.ignorePatterns || this.DEFAULT_IGNORES);

    const buildTree = async (currentDir: string, relativeDir = ''): Promise<ProjectTreeNode[]> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      const nodes: ProjectTreeNode[] = [];

      for (const entry of entries) {
        const entryRelPath = path.join(relativeDir, entry.name).replace(/\\/g, '/');
        if (ig.ignores(entryRelPath)) continue;

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          const children = await buildTree(fullPath, entryRelPath);
          nodes.push({
            name: entry.name,
            path: entryRelPath,
            type: 'directory',
            children,
          });
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            nodes.push({
              name: entry.name,
              path: entryRelPath,
              type: 'file',
              size: stats.size,
            });
          } catch {}
        }
      }

      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return nodes;
    };

    return buildTree(project.path);
  }

  async getFileContent(projectId: string, relativePath: string): Promise<{ content: string; language: string; size: number }> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const safePath = this.resolveSafePath(project.path, relativePath);
    const stats = await fs.stat(safePath);
    if (!stats.isFile()) throw new Error('O caminho especificado não é um arquivo');

    const content = await fs.readFile(safePath, 'utf-8');
    const language = chunkerService.detectLanguage(path.basename(safePath)) || 'text';

    return {
      content,
      language,
      size: stats.size,
    };
  }

  async saveProjectFile(
    projectId: string,
    relativePath: string,
    content: string
  ): Promise<{ success: boolean; backupCreated: boolean; chunksCount: number }> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const safePath = this.resolveSafePath(project.path, relativePath);
    const normalizedRelPath = relativePath.replace(/\\/g, '/').replace(/^\//, '');

    await fs.mkdir(path.dirname(safePath), { recursive: true });

    let backupCreated = false;
    try {
      await fs.access(safePath);
      const backupPath = `${safePath}.bak`;
      await fs.copyFile(safePath, backupPath);
      backupCreated = true;
    } catch {
    }

    await fs.writeFile(safePath, content, 'utf-8');

    let newChunksCount = 0;
    try {
      const existingChunks = await this.loadProjectVectors(projectId);
      const filteredChunks = existingChunks.filter(c => c.filePath !== normalizedRelPath);

      const linesCount = content.split('\n').length;
      const chunks = chunkerService.process(content, 'code', { filePath: normalizedRelPath });

      for (const c of chunks) {
        const embedding = await ollamaService.generateEmbedding(c.text);
        filteredChunks.push({
          id: randomUUID(),
          projectId: project.id,
          filePath: normalizedRelPath,
          language: c.language || 'text',
          startLine: c.startLine || 1,
          endLine: c.endLine || linesCount,
          chunkIndex: c.chunkIndex || 0,
          text: c.text,
          embedding,
        });
        newChunksCount++;
      }

      await fs.writeFile(this.getVectorsFilePath(projectId), JSON.stringify(filteredChunks), 'utf-8');

      if (project.stats) {
        project.stats.indexedChunks = filteredChunks.length;
      }
      project.updatedAt = Date.now();
      await this.persist();
      logger.info('PROJECT_FILE_SAVE', `Arquivo ${normalizedRelPath} salvo e ${newChunksCount} chunks re-indexados.`);
    } catch (err) {
      logger.error('PROJECT_FILE_SAVE', `Erro ao re-indexar arquivo ${normalizedRelPath}:`, err);
    }

    return { success: true, backupCreated, chunksCount: newChunksCount };
  }

  async getProjectFileList(projectId: string, maxFiles = 100): Promise<string[]> {
    const project = await this.getProject(projectId);
    if (!project) return [];

    const ig = ignore().add(project.settings?.ignorePatterns || this.DEFAULT_IGNORES);
    const fileList: string[] = [];

    const walk = async (dir: string) => {
      if (fileList.length >= maxFiles) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (fileList.length >= maxFiles) break;
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(project.path, fullPath).replace(/\\/g, '/');
          if (ig.ignores(relPath)) continue;

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            fileList.push(relPath);
          }
        }
      } catch {}
    };

    await walk(project.path);
    return fileList;
  }
}

export const projectService = new ProjectService();
