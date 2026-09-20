import React, { useState, useEffect } from 'react';
import { Project, ProjectSearchResult, ProjectTreeNode } from '../../types/project';
import { 
  Code2, 
  Folder, 
  FolderOpen, 
  FileText, 
  Search, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  MessageSquare, 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  Check 
} from 'lucide-react';
import { api } from '../../services/api';
import hljs from 'highlight.js';

interface ProjectViewProps {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  onSelectProject: (id: string) => void;
  onAddProject: (name: string, path: string) => Promise<Project>;
  onDeleteProject: (id: string) => Promise<void>;
  onReindexProject: (id: string) => Promise<void>;
  onSearchProject: (id: string, query: string) => Promise<ProjectSearchResult[]>;
  onOpenChat?: (projectId: string) => void;
}

export const ProjectView: React.FC<ProjectViewProps> = ({
  projects,
  activeProjectId,
  activeProject,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onReindexProject,
  onSearchProject,
  onOpenChat,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const [addingError, setAddingError] = useState('');

  const [tree, setTree] = useState<ProjectTreeNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<{ content: string; language: string; size: number } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProjectSearchResult[]>([]);

  useEffect(() => {
    if (!activeProjectId) {
      setTree([]);
      setSelectedFile(null);
      setFileContent(null);
      setSearchResults([]);
      return;
    }

    let isMounted = true;
    setLoadingTree(true);
    setTreeError(null);

    api.getProjectTree(activeProjectId)
      .then(nodes => {
        if (isMounted) {
          setTree(nodes);
          const firstDir = nodes.find(n => n.type === 'directory');
          if (firstDir) {
            setExpandedFolders(prev => ({ ...prev, [firstDir.path]: true }));
          }
        }
      })
      .catch(err => {
        if (isMounted) setTreeError(err.message || 'Falha ao carregar arquivos');
      })
      .finally(() => {
        if (isMounted) setLoadingTree(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeProjectId]);

  const handleSelectFile = async (filePath: string) => {
    if (!activeProjectId) return;
    setSelectedFile(filePath);
    setLoadingFile(true);

    try {
      const data = await api.getProjectFile(activeProjectId, filePath);
      setFileContent(data);
    } catch (err: any) {
      setFileContent({ content: `// Erro ao carregar arquivo: ${err.message}`, language: 'text', size: 0 });
    } finally {
      setLoadingFile(false);
    }
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId || !searchQuery.trim() || searching) return;

    setSearching(true);
    try {
      const results = await onSearchProject(activeProjectId, searchQuery.trim());
      setSearchResults(results);
    } catch (err: any) {
      alert(err.message || 'Erro ao realizar busca de código');
    } finally {
      setSearching(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingError('');
    if (!newProjectName.trim() || !newProjectPath.trim()) return;

    try {
      await onAddProject(newProjectName, newProjectPath);
      setIsAdding(false);
      setNewProjectName('');
      setNewProjectPath('');
    } catch (err: any) {
      setAddingError(err.message);
    }
  };

  const handleReindex = async () => {
    if (!activeProjectId) return;
    try {
      await onReindexProject(activeProjectId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  if (!activeProject && projects.length > 0) {
    onSelectProject(projects[0].id);
  }

  const renderTreeNodes = (nodes: ProjectTreeNode[], depth = 0) => {
    return nodes.map(node => {
      if (node.type === 'directory') {
        const isExpanded = !!expandedFolders[node.path];
        return (
          <div key={node.path} className="select-none">
            <button
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
              className="w-full flex items-center gap-1.5 py-1 px-2 text-xs font-mono text-slate-300 hover:text-slate-100 hover:bg-[#151328] rounded transition-colors text-left group"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-purple-500/70" />
              )}
              <span className="truncate">{node.name}</span>
            </button>

            {isExpanded && node.children && node.children.length > 0 && (
              <div>{renderTreeNodes(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      const isSelected = selectedFile === node.path;
      return (
        <button
          key={node.path}
          onClick={() => handleSelectFile(node.path)}
          style={{ paddingLeft: `${depth * 14 + 24}px` }}
          className={`w-full flex items-center gap-2 py-1 px-2 text-xs font-mono rounded transition-colors text-left truncate ${
            isSelected
              ? 'bg-purple-900/40 text-purple-200 border border-purple-700/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#131124] border border-transparent'
          }`}
          title={node.path}
        >
          <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-purple-300' : 'text-slate-500'}`} />
          <span className="truncate">{node.name}</span>
          {node.size !== undefined && (
            <span className="text-[10px] text-slate-600 ml-auto shrink-0 font-sans">
              {formatSize(node.size)}
            </span>
          )}
        </button>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden text-slate-200">
      <div className="h-14 border-b border-[#1c1a32] flex items-center justify-between px-6 shrink-0 bg-[#07050e]/50 backdrop-blur-sm select-none">
        <h1 className="text-sm font-semibold tracking-wide flex items-center gap-2">
          <Code2 className="w-4 h-4 text-purple-400" />
          <span>Workspace de Projetos</span>
        </h1>

        {activeProject && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              Projeto Selecionado: <strong className="text-purple-300">{activeProject.name}</strong>
            </span>
            {onOpenChat && (
              <button
                onClick={() => onOpenChat(activeProject.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg text-xs font-medium shadow-md shadow-purple-950/40 transition-all active:scale-95"
                title="Abrir o chat contextualizado com este projeto"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Conversar com este Projeto</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-[#1c1a32] bg-[#07050e]/40 flex flex-col shrink-0">
          <div className="p-4 border-b border-[#1c1a32]">
            <button
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 transition-colors border border-purple-500/30 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Novo Projeto
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                  activeProjectId === p.id
                    ? 'bg-[#18152e] text-purple-100 border border-[#2e2954]'
                    : 'text-slate-400 hover:bg-[#121024] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Folder className={`w-4 h-4 shrink-0 ${activeProjectId === p.id ? 'text-purple-400' : 'text-slate-500'}`} />
                  <span className="truncate text-sm font-medium">{p.name}</span>
                </div>
                {p.status === 'indexing' && <RefreshCw className="w-3 h-3 text-purple-400 animate-spin shrink-0" />}
                {p.status === 'ready' && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                {p.status === 'error' && <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />}
              </button>
            ))}

            {projects.length === 0 && !isAdding && (
              <div className="text-center p-4 text-sm text-slate-500">
                Nenhum projeto adicionado ainda.
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#07050e]/60 p-6">
          {isAdding ? (
            <div className="max-w-xl mx-auto mt-10 bg-[#100f1c] rounded-xl border border-[#2a264a] p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-purple-100 mb-6">Adicionar Projeto Local</h2>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome do Projeto</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    placeholder="Ex: Meu Projeto Ollama"
                    className="w-full bg-[#0b0a13] border border-[#2a264a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Caminho Local Absoluto</label>
                  <input
                    type="text"
                    value={newProjectPath}
                    onChange={e => setNewProjectPath(e.target.value)}
                    placeholder="Ex: C:\MeusProjetos\App"
                    className="w-full bg-[#0b0a13] border border-[#2a264a] rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-purple-500/50 font-mono"
                  />
                </div>

                {addingError && (
                  <div className="text-rose-400 text-xs bg-rose-500/10 p-2 rounded border border-rose-500/20">
                    {addingError}
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-[#1c1a32]">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!newProjectName || !newProjectPath}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Adicionar Projeto
                  </button>
                </div>
              </form>
            </div>
          ) : activeProject ? (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-[#100f1c] rounded-xl border border-[#2a264a] p-6 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start mb-6 relative z-10 flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                      <Folder className="w-6 h-6 text-purple-400" />
                      {activeProject.name}
                    </h2>
                    <p className="text-slate-500 font-mono text-xs mt-1">{activeProject.path}</p>
                  </div>

                  <div className="flex gap-2">
                    {onOpenChat && (
                      <button
                        onClick={() => onOpenChat(activeProject.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium shadow-md shadow-purple-950/40 transition-colors"
                        title="Ir para o Chat com este Projeto"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Abrir no Chat</span>
                      </button>
                    )}

                    <button
                      onClick={handleReindex}
                      disabled={activeProject.status === 'indexing'}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#1a182e] hover:bg-[#221f3d] border border-[#2e2954] rounded-lg text-xs font-medium text-slate-300 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${activeProject.status === 'indexing' ? 'animate-spin text-purple-400' : ''}`} />
                      {activeProject.status === 'indexing' ? 'Indexando...' : 'Reindexar'}
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm('Remover projeto? Os arquivos locais no seu disco não serão apagados.')) {
                          onDeleteProject(activeProject.id);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-900/50 rounded-lg text-xs font-medium text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
                  <div className="bg-[#0b0a13] rounded-lg border border-[#1c1a32] p-4">
                    <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Status RAG</div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {activeProject.status === 'indexing' && <span className="text-purple-400 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Indexando</span>}
                      {activeProject.status === 'ready' && <span className="text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Indexado</span>}
                      {activeProject.status === 'error' && <span className="text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Erro</span>}
                      {activeProject.status === 'idle' && <span className="text-slate-400">Aguardando</span>}
                    </div>
                  </div>
                  <div className="bg-[#0b0a13] rounded-lg border border-[#1c1a32] p-4">
                    <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Arquivos</div>
                    <div className="text-lg font-mono font-medium text-slate-200">{activeProject.stats?.totalFiles || 0}</div>
                  </div>
                  <div className="bg-[#0b0a13] rounded-lg border border-[#1c1a32] p-4">
                    <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Linhas de Código</div>
                    <div className="text-lg font-mono font-medium text-slate-200">{activeProject.stats?.totalLines || 0}</div>
                  </div>
                  <div className="bg-[#0b0a13] rounded-lg border border-[#1c1a32] p-4">
                    <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Tamanho</div>
                    <div className="text-lg font-mono font-medium text-slate-200">{formatSize(activeProject.stats?.totalSizeInBytes || 0)}</div>
                  </div>
                </div>
              </div>

              <div className="bg-[#100f1c] rounded-xl border border-[#2a264a] overflow-hidden shadow-xl">
                <div className="px-5 py-3.5 border-b border-[#221e3f] bg-[#121025] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-slate-200">Arquivos do Projeto & Código</h3>
                  </div>
                  {selectedFile && (
                    <span className="text-xs font-mono text-purple-300">
                      {selectedFile}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 min-h-[380px]">
                  <div className="border-r border-[#1e1a38] bg-[#0c0a18] p-3 overflow-y-auto max-h-[500px]">
                    <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500 mb-2 px-2">
                      Estrutura do Projeto
                    </div>

                    {loadingTree ? (
                      <div className="flex items-center justify-center p-8 text-xs text-slate-500 gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                        <span>Carregando arquivos...</span>
                      </div>
                    ) : treeError ? (
                      <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded text-rose-300 text-xs">
                        {treeError}
                      </div>
                    ) : tree.length === 0 ? (
                      <div className="text-xs text-slate-500 p-4 text-center">
                        Nenhum arquivo encontrado no projeto.
                      </div>
                    ) : (
                      <div className="space-y-0.5">{renderTreeNodes(tree)}</div>
                    )}
                  </div>

                  <div className="md:col-span-2 bg-[#090814] flex flex-col overflow-hidden max-h-[500px]">
                    {selectedFile && fileContent ? (
                      <>
                        <div className="flex items-center justify-between px-4 py-2 bg-[#121022] border-b border-[#211d3d] text-xs font-mono">
                          <span className="text-slate-300 truncate">{selectedFile}</span>
                          <button
                            onClick={() => copyToClipboard(fileContent.content)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1f1a3a] transition-colors"
                            title="Copiar código"
                          >
                            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>

                        <div className="flex-1 p-4 overflow-auto text-xs font-mono leading-relaxed selection:bg-purple-900/60 selection:text-white">
                          <pre className="m-0">
                            <code
                              dangerouslySetInnerHTML={{
                                __html: (() => {
                                  try {
                                    if (fileContent.language && hljs.getLanguage(fileContent.language)) {
                                      return hljs.highlight(fileContent.content, { language: fileContent.language, ignoreIllegals: true }).value;
                                    }
                                    return hljs.highlightAuto(fileContent.content).value;
                                  } catch {
                                    return fileContent.content
                                      .replace(/&/g, '&amp;')
                                      .replace(/</g, '&lt;')
                                      .replace(/>/g, '&gt;');
                                  }
                                })(),
                              }}
                            />
                          </pre>
                        </div>
                      </>
                    ) : loadingFile ? (
                      <div className="flex-1 flex items-center justify-center text-xs text-slate-500 gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                        <span>Lendo arquivo...</span>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs p-8 text-center">
                        <FileText className="w-8 h-8 text-slate-600 mb-2" />
                        <span>Selecione um arquivo na árvore ao lado para visualizar seu conteúdo.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-[#100f1c] rounded-xl border border-[#2a264a] p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <Search className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-semibold text-slate-200">Busca Semântica no Código (RAG)</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Faça uma pesquisa conceitual para testar o que a IA recuperará dos arquivos deste projeto.
                </p>

                <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Ex: rotina de inicialização, driver entry, autenticação..."
                    className="flex-1 px-3 py-2 bg-[#0b0a13] border border-[#2a264a] rounded-lg text-sm text-slate-200 outline-none focus:border-purple-500/50"
                  />
                  <button
                    type="submit"
                    disabled={searching || !searchQuery.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>Buscar</span>
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs text-slate-400 font-medium">
                      Resultados encontrados ({searchResults.length}):
                    </div>
                    {searchResults.map((result, idx) => (
                      <div
                        key={result.id || idx}
                        className="p-3 rounded-lg bg-[#0b0a13] border border-[#232042] text-xs font-mono"
                      >
                        <div className="flex items-center justify-between text-purple-300 mb-1.5">
                          <span className="font-semibold">{result.filePath} (L{result.startLine}-{result.endLine})</span>
                          <span className="text-emerald-400 text-[10px]">
                            Relevância: {Math.round(result.score * 100)}%
                          </span>
                        </div>
                        <pre className="p-2 bg-[#06050b] rounded text-slate-300 text-[11px] overflow-x-auto">
                          <code>{result.text}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 text-sm">
              Selecione ou crie um projeto para começar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
