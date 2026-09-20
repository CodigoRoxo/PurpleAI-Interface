import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Project, ProjectSearchResult } from '../types/project';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const addProject = async (name: string, path: string) => {
    const data = await api.createProject(name, path);
    setProjects(prev => [...prev, data]);
    setActiveProjectId(data.id);
    return data;
  };

  const deleteProject = async (id: string) => {
    await api.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
  };

  const reindexProject = async (id: string) => {
    await api.reindexProject(id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'indexing' } : p));
    
    const interval = setInterval(async () => {
      try {
        const data = await api.getProject(id);
        setProjects(prev => prev.map(p => p.id === id ? data : p));
        if (data.status !== 'indexing') {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);
  };

  const searchProject = async (id: string, query: string): Promise<ProjectSearchResult[]> => {
    return api.searchProject(id, query, 10, 0.1);
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  return {
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    loading,
    error,
    refreshProjects: fetchProjects,
    addProject,
    deleteProject,
    reindexProject,
    searchProject
  };
}
