import React, { useState } from 'react';
import { Folder, Plus, Trash2, X, Check, Layers } from 'lucide-react';
import { KnowledgeCollection, KnowledgeSource } from '../../types/knowledge';

interface CollectionsBarProps {
  collections: KnowledgeCollection[];
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onCreateCollection: (data: { name: string; description?: string; color?: string }) => Promise<KnowledgeCollection>;
  onDeleteCollection: (id: string) => Promise<void>;
  sources: KnowledgeSource[];
}

const PRESET_COLORS = [
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#3b82f6',
  '#ef4444',
];

export const CollectionsBar: React.FC<CollectionsBarProps> = ({
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onDeleteCollection,
  sources,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const getCollectionCount = (collectionId?: string) => {
    if (!collectionId) return sources.length;
    return sources.filter(s => s.collectionId === collectionId).length;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      await onCreateCollection({ name: name.trim(), description: description.trim(), color });
      setName('');
      setDescription('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao criar coleção:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-accent" />
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Coleções de Conhecimento
          </h2>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium px-2 py-1 rounded-md hover:bg-purple-950/40"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova Coleção</span>
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => onSelectCollection(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all whitespace-nowrap ${
            selectedCollectionId === null
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-md shadow-purple-950/30'
              : 'bg-[#100e20]/80 text-slate-400 hover:text-slate-200 border border-[#232042]'
          }`}
        >
          <Folder className="w-3.5 h-3.5 text-purple-400" />
          <span>Todas ({sources.length})</span>
        </button>

        {collections.map(col => {
          const count = getCollectionCount(col.id);
          const isSelected = selectedCollectionId === col.id;

          return (
            <div
              key={col.id}
              className={`group flex items-center rounded-xl text-xs font-mono transition-all whitespace-nowrap border ${
                isSelected
                  ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-md shadow-purple-950/30'
                  : 'bg-[#100e20]/80 text-slate-400 hover:text-slate-200 border-[#232042]'
              }`}
            >
              <button
                onClick={() => onSelectCollection(col.id)}
                className="flex items-center gap-1.5 px-3 py-1.5"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: col.color || '#a855f7' }}
                />
                <span>{col.name}</span>
                <span className="text-[10px] text-slate-500 group-hover:text-slate-400">({count})</span>
              </button>

              {!col.id.startsWith('col_win') && !col.id.startsWith('col_rev') && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (window.confirm(`Excluir coleção "${col.name}"? As fontes não serão apagadas.`)) {
                      onDeleteCollection(col.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 mr-1.5 text-slate-500 hover:text-rose-400 transition-opacity"
                  title="Excluir coleção"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e0c1e] border border-purple-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232042] pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Folder className="w-4 h-4 text-purple-accent" />
                <span>Criar Nova Coleção</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nome da Coleção *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Documentação, Tutoriais, Referências..."
                  className="w-full px-3 py-2 bg-[#141228] border border-[#2e2954] rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Descrição (Opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Breve propósito desta coleção..."
                  className="w-full px-3 py-2 bg-[#141228] border border-[#2e2954] rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Cor da Tag
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform flex items-center justify-center ${
                        color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#232042]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-[#181530]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-950/50 disabled:opacity-40"
                >
                  {creating ? 'Criando...' : 'Salvar Coleção'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
