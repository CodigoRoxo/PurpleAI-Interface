import React, { useState } from 'react';
import {
  Database,
  Plus,
  Search,
  BookOpen,
  Code2,
  FileText,
  RotateCw,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  HardDrive,
  Cpu,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Activity,
} from 'lucide-react';
import {
  KnowledgeSource,
  KnowledgeChunk,
  KnowledgeCollection,
  RAGDebugTrace,
  TestResult,
} from '../../types/knowledge';
import { AddSourceModal } from './AddSourceModal';
import { ChunkViewerModal } from './ChunkViewerModal';
import { CollectionsBar } from './CollectionsBar';
import { KnowledgeDebugView } from './KnowledgeDebugView';

interface KnowledgeViewProps {
  sources: KnowledgeSource[];
  allSources?: KnowledgeSource[];
  collections: KnowledgeCollection[];
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onCreateCollection: (data: { name: string; description?: string; color?: string }) => Promise<KnowledgeCollection>;
  onDeleteCollection: (id: string) => Promise<void>;
  stats: {
    totalSources: number;
    totalChunks: number;
    totalSizeBytes: number;
    activeSources: number;
  };
  uploadFile: (file: File, collectionId?: string) => Promise<KnowledgeSource>;
  reindex: (id: string) => Promise<void>;
  toggleSource: (id: string, enabled?: boolean) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  testSearch: (query: string) => Promise<void>;
  searchResults: any[];
  searching: boolean;
  clearSearch: () => void;
  getChunks: (sourceId: string) => Promise<KnowledgeChunk[]>;
  debugTrace: RAGDebugTrace | null;
  debugging: boolean;
  onExecuteDebug: (query: string) => Promise<any>;
  onRunSanity: () => Promise<TestResult>;
  sanityResult: TestResult | null;
  testingSanity: boolean;
  onRunNegative: () => Promise<TestResult>;
  negativeResult: TestResult | null;
  testingNegative: boolean;
}

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({
  sources,
  allSources = sources,
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onDeleteCollection,
  stats,
  uploadFile,
  reindex,
  toggleSource,
  deleteSource,
  testSearch,
  searchResults,
  searching,
  clearSearch,
  getChunks,
  debugTrace,
  debugging,
  onExecuteDebug,
  onRunSanity,
  sanityResult,
  testingSanity,
  onRunNegative,
  negativeResult,
  testingNegative,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'sources' | 'debug'>('sources');
  const [selectedSourceForChunks, setSelectedSourceForChunks] = useState<KnowledgeSource | null>(null);
  const [sourceChunks, setSourceChunks] = useState<KnowledgeChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      testSearch(searchQuery.trim());
    }
  };

  const handleOpenChunks = async (source: KnowledgeSource) => {
    setSelectedSourceForChunks(source);
    setLoadingChunks(true);
    try {
      const chunks = await getChunks(source.id);
      setSourceChunks(chunks);
    } catch (err) {
      console.error('Falha ao obter chunks:', err);
      setSourceChunks([]);
    } finally {
      setLoadingChunks(false);
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <BookOpen className="w-4 h-4 text-rose-400" />;
      case 'code':
        return <Code2 className="w-4 h-4 text-emerald-400" />;
      default:
        return <FileText className="w-4 h-4 text-purple-accent" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getCollectionName = (colId?: string) => {
    if (!colId) return null;
    const col = collections.find(c => c.id === colId);
    return col ? col.name : null;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto select-none p-4 md:p-8 bg-transparent relative z-10">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1c1a32] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-purple-950/90 border border-purple-800/50 flex items-center justify-center text-purple-300">
                <Database className="w-3.5 h-3.5 text-purple-accent" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                Base de Conhecimento Local (RAG)
              </h1>
            </div>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Biblioteca técnica local para modelos Ollama. Metadados verificáveis, observabilidade completa e proteção estrita contra alucinação.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6d28d9] via-[#7c3aed] to-[#8b5cf6] hover:from-[#7c3aed] hover:to-[#9333ea] text-white text-xs font-semibold shadow-lg shadow-purple-950/50 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Material</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-[#1c1a32] pb-1">
          <button
            onClick={() => setActiveTab('sources')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-medium transition-all ${
              activeTab === 'sources'
                ? 'bg-purple-950/60 text-purple-200 border-b-2 border-purple-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Materiais & Fontes ({sources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('debug')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-medium transition-all ${
              activeTab === 'debug'
                ? 'bg-purple-950/60 text-purple-200 border-b-2 border-purple-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4 text-purple-accent" />
            <span>🔬 Diagnóstico & Debug RAG</span>
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          </button>
        </div>

        {activeTab === 'debug' ? (
          <KnowledgeDebugView
            debugTrace={debugTrace}
            debugging={debugging}
            onExecuteDebug={onExecuteDebug}
            onRunSanity={onRunSanity}
            sanityResult={sanityResult}
            testingSanity={testingSanity}
            onRunNegative={onRunNegative}
            negativeResult={negativeResult}
            testingNegative={testingNegative}
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-[#0c0b16]/80 backdrop-blur-md border border-[#232042] shadow-lg shadow-purple-950/10">
                <div className="flex items-center gap-2 text-slate-500 mb-1 text-xs">
                  <BookOpen className="w-3.5 h-3.5 text-purple-accent" />
                  <span>Documentos</span>
                </div>
                <span className="text-xl font-bold font-mono text-slate-100">{stats.totalSources}</span>
              </div>

              <div className="p-4 rounded-xl bg-[#0c0b16]/80 backdrop-blur-md border border-[#232042] shadow-lg shadow-purple-950/10">
                <div className="flex items-center gap-2 text-slate-500 mb-1 text-xs">
                  <Layers className="w-3.5 h-3.5 text-neon-cyan" />
                  <span>Chunks Vetorizados</span>
                </div>
                <span className="text-xl font-bold font-mono text-slate-100">{stats.totalChunks}</span>
              </div>

              <div className="p-4 rounded-xl bg-[#0c0b16]/80 backdrop-blur-md border border-[#232042] shadow-lg shadow-purple-950/10">
                <div className="flex items-center gap-2 text-slate-500 mb-1 text-xs">
                  <HardDrive className="w-3.5 h-3.5 text-purple-glow" />
                  <span>Tamanho em Disco</span>
                </div>
                <span className="text-xl font-bold font-mono text-slate-100">{formatSize(stats.totalSizeBytes)}</span>
              </div>

              <div className="p-4 rounded-xl bg-[#0c0b16]/80 backdrop-blur-md border border-[#232042] shadow-lg shadow-purple-950/10">
                <div className="flex items-center gap-2 text-slate-500 mb-1 text-xs">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Fontes Ativas no Chat</span>
                </div>
                <span className="text-xl font-bold font-mono text-emerald-400">{stats.activeSources}</span>
              </div>
            </div>

            <CollectionsBar
              collections={collections}
              selectedCollectionId={selectedCollectionId}
              onSelectCollection={onSelectCollection}
              onCreateCollection={onCreateCollection}
              onDeleteCollection={onDeleteCollection}
              sources={allSources}
            />

            <div className="rounded-2xl border border-[#232042] bg-[#0c0b16]/80 backdrop-blur-md p-5 shadow-xl shadow-black/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-accent" />
                  <h2 className="text-xs font-semibold text-slate-200">
                    Sandbox de Busca Vetorial
                  </h2>
                </div>
                {searchResults.length > 0 && (
                  <button
                    onClick={clearSearch}
                    className="text-[11px] text-slate-500 hover:text-slate-300"
                  >
                    Limpar resultados
                  </button>
                )}
              </div>

              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Teste uma consulta semântica (ex: 'arquitetura do sistema', 'autenticação', 'banco de dados')..."
                    className="w-full pl-9 pr-4 py-2 bg-[#121024] border border-[#272445] rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="px-4 py-2 rounded-xl bg-[#1e1b38] hover:bg-purple-900/50 text-slate-200 text-xs font-medium border border-[#342d63] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Buscar</span>
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-[#1e1b38] pt-4">
                  <span className="text-[11px] text-slate-500 font-mono block">
                    {searchResults.length} trechos recuperados:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {searchResults.map((r, idx) => (
                      <div
                        key={r.id || idx}
                        className="p-3 rounded-xl bg-[#121024]/90 border border-[#272445] text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-purple-300 truncate max-w-[200px]">
                            {r.sourceTitle}
                          </span>
                          <span className="text-emerald-400 font-mono">
                            Score: {(r.score * 100).toFixed(1)}%
                          </span>
                        </div>
                        {r.pageNumber && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Página {r.pageNumber} {r.chapter ? `· ${r.chapter}` : ''}
                          </span>
                        )}
                        <p className="text-slate-300 font-mono text-[11px] line-clamp-3 leading-relaxed">
                          {r.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#232042] bg-[#0c0b16]/80 backdrop-blur-md overflow-hidden shadow-xl shadow-black/40">
              <div className="p-4 border-b border-[#1c1a32] flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-200">
                  Fontes Indexadas ({sources.length})
                </h2>
                <span className="text-[11px] text-slate-500">
                  Ative ou desative materiais para controlar o escopo da RAG
                </span>
              </div>

              {sources.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-500 space-y-3">
                  <Database className="w-8 h-8 text-slate-600 mx-auto" />
                  <p>Nenhum documento encontrado nesta coleção.</p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2"
                  >
                    Clique aqui para adicionar seu primeiro PDF ou livro técnico
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#1a182e]">
                  {sources.map(source => {
                    const isIndexing = source.status === 'indexing';
                    const isError = source.status === 'error';
                    const colName = getCollectionName(source.collectionId);

                    return (
                      <div
                        key={source.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#110f22]/50 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="p-2.5 rounded-xl bg-[#141226] border border-[#272445] flex-shrink-0 mt-0.5">
                            {getSourceIcon(source.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="text-xs font-semibold text-slate-200 truncate">
                                {source.title}
                              </h3>
                              {colName && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                                  {colName}
                                </span>
                              )}
                              {source.status === 'indexed' && (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Indexado</span>
                                </span>
                              )}
                              {isIndexing && (
                                <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono animate-pulse">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Indexando ({source.progress}%)</span>
                                </span>
                              )}
                              {isError && (
                                <span className="flex items-center gap-1 text-[10px] text-rose-400 font-mono">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Erro</span>
                                </span>
                              )}
                            </div>

                            {isIndexing && (
                              <div className="w-full max-w-md my-1.5">
                                <div className="w-full h-1.5 rounded-full bg-[#1e1b38] overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-purple-600 to-neon-purple transition-all duration-300"
                                    style={{ width: `${source.progress}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-purple-300 font-mono mt-0.5 block">
                                  {source.statusMessage || 'Processando...'}
                                </span>
                              </div>
                            )}

                            {isError && (
                              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-rose-300 font-mono bg-rose-950/40 border border-rose-800/60 px-3 py-1.5 rounded-lg max-w-xl">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                                <span className="truncate flex-1">{source.statusMessage || source.error || 'Falha ao processar arquivo'}</span>
                                <button
                                  onClick={() => reindex(source.id)}
                                  className="text-xs text-rose-300 hover:text-rose-100 underline underline-offset-2 whitespace-nowrap ml-2"
                                >
                                  Tentar novamente
                                </button>
                              </div>
                            )}

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-1">
                              <span>{source.fileName}</span>
                              <span>·</span>
                              <span>{formatSize(source.fileSize)}</span>
                              <span>·</span>
                              <span className="text-purple-300 font-semibold">{source.chunkCount} chunks</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => toggleSource(source.id, !source.enabled)}
                            disabled={source.status !== 'indexed'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                              source.enabled && source.status === 'indexed'
                                ? 'bg-purple-950/80 text-purple-300 border border-purple-700/60'
                                : 'bg-[#121024] text-slate-500 border border-[#272445]'
                            } disabled:opacity-30`}
                            title={source.enabled ? 'Ativo para busca no chat' : 'Inativo para busca no chat'}
                          >
                            {source.enabled ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-purple-accent" />
                                <span>Ativo</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-slate-500" />
                                <span>Inativo</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleOpenChunks(source)}
                            disabled={source.status !== 'indexed'}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#1f1c3a] border border-[#272445] transition-colors disabled:opacity-30"
                            title="Inspecionar trechos indexados"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => reindex(source.id)}
                            disabled={isIndexing}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#1f1c3a] border border-[#272445] transition-colors disabled:opacity-30"
                            title="Reindexar este documento"
                          >
                            <RotateCw className={`w-3.5 h-3.5 ${isIndexing ? 'animate-spin text-purple-accent' : ''}`} />
                          </button>

                          <button
                            onClick={() => {
                              if (window.confirm(`Tem certeza que deseja excluir "${source.title}" e todos os seus vetores?`)) {
                                deleteSource(source.id);
                              }
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-[#272445] hover:border-rose-800/40 transition-colors"
                            title="Excluir documento permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AddSourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUpload={uploadFile}
      />

      <ChunkViewerModal
        isOpen={selectedSourceForChunks !== null}
        onClose={() => setSelectedSourceForChunks(null)}
        source={selectedSourceForChunks}
        chunks={sourceChunks}
        loading={loadingChunks}
      />
    </div>
  );
};
