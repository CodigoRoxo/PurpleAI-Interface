export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  updatedAt: number;
  lastIndexedAt?: number;
  status: 'idle' | 'indexing' | 'ready' | 'error';
  stats?: ProjectStats;
  settings?: ProjectSettings;
}

export interface ProjectStats {
  totalFiles: number;
  totalLines: number;
  totalSizeInBytes: number;
  indexedChunks: number;
}

export interface ProjectSettings {
  ignorePatterns: string[];
}

export interface ProjectFile {
  projectId: string;
  filePath: string;
  language: string;
  sizeInBytes: number;
  lines: number;
  lastModified: number;
}

export interface ProjectSearchResult {
  id: string;
  projectId: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  chunkIndex: number;
  text: string;
  score: number;
}

export interface ProjectTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: ProjectTreeNode[];
}

