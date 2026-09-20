import React, { useState } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Code2, Database, MessagesSquare, Cpu } from 'lucide-react';
import { ConversationSummary } from '../../types/chat';

interface SidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  currentView: 'chat' | 'knowledge' | 'projects';
  onNavigate: (view: 'chat' | 'knowledge' | 'projects') => void;
  activeKnowledgeCount?: number;
  projectsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  isOpen,
  onClose,
  currentView,
  onNavigate,
  activeKnowledgeCount = 0,
  projectsCount = 0,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');

  const startEditing = (e: React.MouseEvent, conv: ConversationSummary) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const confirmRename = (e: React.MouseEvent | React.FormEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRename(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir esta conversa?')) {
      onDelete(id);
    }
  };

  const NavItem = ({ view, icon: Icon, label, badge, disabled = false }: any) => {
    const isActive = currentView === view;
    return (
      <button
        onClick={() => {
          if (!disabled) {
            onNavigate(view);
            onClose();
          }
        }}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-3 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-purple-950/80 text-purple-200 border border-purple-700/60 shadow-md shadow-purple-950/40'
            : disabled 
              ? 'text-slate-600 cursor-not-allowed opacity-70' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#18152e] border border-transparent'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${isActive ? 'text-purple-accent' : 'text-slate-500'}`} />
          <span>{label}</span>
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="w-5 h-5 rounded bg-purple-900/60 text-purple-300 text-[10px] flex items-center justify-center font-mono border border-purple-800/50">
            {badge}
          </span>
        )}
        {disabled && (
          <span className="text-[9px] uppercase font-mono tracking-wider text-purple-500/50 border border-purple-900/30 px-1.5 py-0.5 rounded">
            Soon
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-72 bg-[#090812] border-r border-[#1a182e] flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } select-none`}
      >
        <div className="p-4 border-b border-[#1a182e] space-y-4">
          <button
            onClick={() => {
              onNew();
              onNavigate('chat');
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#5b21b6] via-[#7c3aed] to-[#8b5cf6] hover:from-[#6d28d9] hover:to-[#9333ea] text-white text-sm font-medium shadow-md shadow-purple-950/50 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
          
          <div className="space-y-1">
            <NavItem view="chat" icon={MessagesSquare} label="Chats" />
            <NavItem view="knowledge" icon={Database} label="Knowledge" badge={activeKnowledgeCount} />
            <NavItem view="projects" icon={Code2} label="Projects" badge={projectsCount} />
            <NavItem view="agents" icon={Cpu} label="Agents" disabled />
          </div>
        </div>

        {currentView === 'chat' ? (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Histórico ({conversations.length})
            </div>

            {conversations.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-slate-500">
                Nenhuma conversa salva ainda. Inicie um novo chat!
              </div>
            ) : (
              conversations.map(conv => {
                const isActive = conv.id === activeId;
                const isEditing = conv.id === editingId;

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      onSelect(conv.id);
                      onClose();
                    }}
                    className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg text-xs cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[#18162d] text-slate-100 border border-[#2e2954]'
                        : 'text-slate-400 hover:bg-[#111022] hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <MessageSquare
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isActive ? 'text-purple-accent' : 'text-slate-500 group-hover:text-slate-400'
                        }`}
                      />

                      {isEditing ? (
                        <form
                          onSubmit={e => confirmRename(e, conv.id)}
                          className="flex items-center gap-1 flex-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            autoFocus
                            className="w-full bg-[#0a0914] text-slate-200 border border-purple-500 rounded px-1.5 py-0.5 text-xs outline-none"
                          />
                          <button
                            type="submit"
                            className="p-1 hover:text-emerald-400 text-slate-400"
                            title="Confirmar"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            className="p-1 hover:text-rose-400 text-slate-400"
                            title="Cancelar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </form>
                      ) : (
                        <span className="truncate font-medium">{conv.title}</span>
                      )}
                    </div>

                    {!isEditing && (
                      <div
                        className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                          isActive ? 'opacity-100' : ''
                        }`}
                      >
                        <button
                          onClick={e => startEditing(e, conv)}
                          className="p-1 text-slate-500 hover:text-slate-300 hover:bg-[#201d3b] rounded transition-colors"
                          title="Renomear conversa"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={e => handleDelete(e, conv.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-[#201d3b] rounded transition-colors"
                          title="Excluir conversa"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex-1 p-4 text-xs text-slate-400 space-y-4 overflow-y-auto">
            <div className="p-3 rounded-xl bg-[#110f22] border border-[#221e3f] space-y-2">
              <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider block">
                Sobre a RAG Local
              </span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Adicione PDFs, livros, documentações ou bases de código. Ao conversar no Chat com o RAG ativo, o PurpleAI injeta trechos exatos para fundamentar as respostas do modelo.
              </p>
            </div>
            <button
              onClick={() => onNavigate('chat')}
              className="w-full py-2 px-3 rounded-xl bg-[#151329] border border-[#282449] hover:border-purple-600/60 text-slate-300 text-xs font-medium transition-all text-center block"
            >
              ← Voltar para o Chat
            </button>
          </div>
        )}

        <div className="p-3 border-t border-[#1a182e] bg-[#07060e] flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-purple-accent" />
            <span className="text-[11px] font-mono">Dev Engine V2 (RAG)</span>
          </div>
          <span className="text-[10px] text-slate-600">Local Only</span>
        </div>
      </aside>
    </>
  );
};
