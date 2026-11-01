import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FilePen,
  FilePlus2,
  FileSearch,
  FileText,
  FolderTree,
  Loader2,
  OctagonX,
  Plus,
  Search,
  Square,
  ArrowUp,
  Trash2,
  Undo2,
  AlertCircle,
  AlertTriangle,
  X,
  SquareTerminal,
  Library,
  ShieldCheck,
} from 'lucide-react';
import { Project } from '../../types/project';
import { AgentToolItem, DiffLine, TimelineItem } from '../../types/agent';
import { useAgent } from '../../hooks/useAgent';

interface AgentViewProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  selectedModel: string;
}

const TOOL_ICONS: Record<string, React.ElementType> = {
  list_dir: FolderTree,
  read_file: FileText,
  grep: Search,
  glob: FileSearch,
  edit_file: FilePen,
  write_file: FilePlus2,
  run_command: SquareTerminal,
  search_knowledge: Library,
};

const ApprovalCard: React.FC<{
  item: AgentToolItem;
  onApprove: (stepId: string, approved: boolean, remember?: boolean) => void;
}> = ({ item, onApprove }) => (
  <div className="px-3 pb-3 space-y-2">
    <div className="text-[11px] text-amber-200/90">
      O agente quer executar este comando{item.cwd && item.cwd !== '.' ? ` em ${item.cwd}` : ' na pasta do projeto'}:
    </div>
    <pre className="text-xs font-mono text-amber-100 bg-black/50 border border-amber-800/40 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">
      {item.command}
    </pre>
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onApprove(item.id, true)}
        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold"
      >
        Executar
      </button>
      <button
        onClick={() => onApprove(item.id, true, true)}
        className="px-3 py-1.5 rounded-lg bg-[#141226] border border-emerald-800/60 hover:border-emerald-600 text-emerald-300 text-xs"
        title="Executa agora e não pergunta de novo por este comando exato neste projeto"
      >
        Sempre permitir este comando
      </button>
      <button
        onClick={() => onApprove(item.id, false)}
        className="px-3 py-1.5 rounded-lg bg-[#141226] border border-rose-800/60 hover:border-rose-600 text-rose-300 text-xs"
      >
        Recusar
      </button>
    </div>
  </div>
);

const SUGGESTIONS = [
  'Explique a estrutura deste projeto',
  'Encontre possíveis bugs e me mostre antes de corrigir',
  'Adicione comentários nas funções mais complexas',
];

const DiffView: React.FC<{ diff: DiffLine[] }> = ({ diff }) => (
  <div className="rounded-lg border border-[#1c1a32] bg-[#07060d] overflow-x-auto max-h-96 overflow-y-auto">
    <pre className="text-[11px] leading-5 font-mono">
      {diff.map((line, i) => (
        <div
          key={i}
          className={
            line.type === '+'
              ? 'bg-emerald-950/50 text-emerald-300 px-3'
              : line.type === '-'
                ? 'bg-rose-950/50 text-rose-300 px-3'
                : line.type === '@'
                  ? 'text-purple-400/70 px-3 py-0.5 bg-purple-950/20'
                  : 'text-slate-500 px-3'
          }
        >
          {line.type === '@' ? `@@ ${line.text}` : `${line.type} ${line.text}`}
        </div>
      ))}
    </pre>
  </div>
);

const ToolStep: React.FC<{
  item: AgentToolItem;
  canRevert: boolean;
  onRevert: (stepId: string) => void;
  onApprove: (stepId: string, approved: boolean, remember?: boolean) => void;
}> = ({ item, canRevert, onRevert, onApprove }) => {
  const [open, setOpen] = useState(false);
  const Icon = TOOL_ICONS[item.name] || Bot;
  const hasDetails = Boolean(item.diff?.length || item.output || Object.keys(item.args).length);
  const awaiting = item.status === 'awaiting';

  return (
    <div
      className={`rounded-lg border bg-[#0c0b16]/80 ${
        awaiting ? 'border-amber-600/60 shadow-[0_0_14px_rgba(245,158,11,0.15)]' : item.reverted ? 'border-[#1c1a32] opacity-50' : 'border-[#232042]'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => hasDetails && setOpen(o => !o)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          {hasDetails ? (
            open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          ) : (
            <span className="w-3.5" />
          )}
          <Icon className={`w-4 h-4 shrink-0 ${item.checkpoint ? 'text-amber-300' : 'text-purple-accent'}`} />
          <span className={`text-xs truncate ${item.status === 'error' ? 'text-rose-300' : item.failed ? 'text-amber-300' : 'text-slate-300'} ${item.reverted ? 'line-through' : ''}`}>
            {awaiting ? 'Aguardando sua aprovação para executar um comando' : item.summary}
          </span>
        </button>
        {item.approval === 'auto_approved' && (
          <span title="Comando liberado com 'Sempre permitir'"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70 shrink-0" /></span>
        )}
        {item.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin shrink-0" />}
        {awaiting && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        {item.status === 'ok' && !item.failed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
        {item.status === 'ok' && item.failed && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        {item.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
        {item.checkpoint && !item.reverted && canRevert && (
          <button
            onClick={() => {
              if (window.confirm(`Desfazer esta alteração e todas as seguintes desta tarefa?`)) onRevert(item.id);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-amber-300 hover:bg-amber-950/40 border border-amber-800/40 shrink-0"
            title="Restaura os arquivos para antes desta etapa"
          >
            <Undo2 className="w-3 h-3" />
            Desfazer até aqui
          </button>
        )}
        {item.reverted && <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">desfeito</span>}
      </div>

      {awaiting && <ApprovalCard item={item} onApprove={onApprove} />}

      {open && !awaiting && (
        <div className="px-3 pb-3 space-y-2">
          {Object.keys(item.args).length > 0 && !item.diff && !item.command && (
            <pre className="text-[11px] font-mono text-slate-400 bg-[#07060d] rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(item.args, null, 2)}
            </pre>
          )}
          {item.diff && item.diff.length > 0 && <DiffView diff={item.diff} />}
          {item.output && (
            <pre className="text-[11px] font-mono text-slate-400 bg-[#07060d] rounded-lg p-2 max-h-72 overflow-auto whitespace-pre">
              {item.output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

const ThinkingBlock: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="text-xs">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300">
        <Brain className="w-3.5 h-3.5" />
        Raciocínio
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {open && <div className="mt-1.5 pl-5 text-slate-500 whitespace-pre-wrap leading-relaxed">{text}</div>}
    </div>
  );
};

const TimelineEntry: React.FC<{
  item: TimelineItem;
  canRevert: boolean;
  onRevert: (stepId: string) => void;
  onApprove: (stepId: string, approved: boolean, remember?: boolean) => void;
}> = ({ item, canRevert, onRevert, onApprove }) => {
  switch (item.kind) {
    case 'user':
      return (
        <div className="flex justify-end">
          <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-purple-900/40 border border-purple-700/40 text-sm text-slate-100 whitespace-pre-wrap">
            {item.text}
          </div>
        </div>
      );
    case 'assistant':
      if (!item.text.trim()) return null;
      return (
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-lg bg-purple-950/90 border border-purple-800/50 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-purple-accent" />
          </div>
          <div className="prose-dark text-[14px] leading-relaxed break-words text-slate-200 min-w-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>
          </div>
        </div>
      );
    case 'thinking':
      return <div className="pl-10"><ThinkingBlock text={item.text} /></div>;
    case 'tool':
      return <div className="pl-10"><ToolStep item={item} canRevert={canRevert} onRevert={onRevert} onApprove={onApprove} /></div>;
    case 'status': {
      const styles = {
        completed: { icon: CheckCircle2, cls: 'text-emerald-400', label: 'Tarefa concluída' },
        max_steps: { icon: AlertTriangle, cls: 'text-amber-400', label: 'Pausado' },
        aborted: { icon: OctagonX, cls: 'text-amber-400', label: 'Interrompido' },
        error: { icon: AlertCircle, cls: 'text-rose-400', label: 'Erro' },
      }[item.status];
      const Icon = styles.icon;
      return (
        <div className={`pl-10 flex items-start gap-2 text-xs ${styles.cls}`}>
          <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            <b>{styles.label}</b>
            {item.message ? ` · ${item.message}` : ''}
          </span>
        </div>
      );
    }
    case 'revert':
      return (
        <div className="pl-10 flex items-center gap-2 text-xs text-amber-300">
          <Undo2 className="w-3.5 h-3.5" />
          Alterações desfeitas em: {item.files.join(', ')}
        </div>
      );
    default:
      return null;
  }
};

export const AgentView: React.FC<AgentViewProps> = ({ projects, activeProjectId, onSelectProject, selectedModel }) => {
  const { sessions, session, running, error, clearError, selectSession, newSession, send, stop, approve, revert, deleteSession } =
    useAgent(activeProjectId, selectedModel);
  const [input, setInput] = useState('');
  const [think, setThink] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sem projeto escolhido, já abre no primeiro: menos um clique para começar
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) onSelectProject(projects[0].id);
  }, [activeProjectId, projects, onSelectProject]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session?.timeline.length, running]);

  const submit = () => {
    if (!input.trim() || running) return;
    send(input.trim(), think);
    setInput('');
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <aside className="w-64 shrink-0 border-r border-[#1a182e] bg-[#090812]/80 flex-col hidden md:flex">
        <div className="p-3 space-y-3 border-b border-[#1a182e]">
          <select
            value={activeProjectId || ''}
            onChange={e => e.target.value && onSelectProject(e.target.value)}
            className="w-full px-2.5 py-2 rounded-lg bg-[#141226] border border-[#272445] text-xs text-slate-200 focus:outline-none"
          >
            <option value="">Selecione um projeto</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={newSession}
            disabled={!activeProjectId}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-[#5b21b6] to-[#8b5cf6] disabled:opacity-40 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova tarefa
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 && (
            <div className="text-[11px] text-slate-500 px-2 py-3">Nenhuma tarefa ainda.</div>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => selectSession(s.id)}
              className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs ${
                session?.id === s.id ? 'bg-purple-950/70 text-purple-100 border border-purple-800/50' : 'text-slate-400 hover:bg-[#18152e] border border-transparent'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">{s.title}</div>
                <div className="text-[10px] text-slate-500 font-mono">{s.steps} passos · {s.model}</div>
              </div>
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (window.confirm('Excluir esta tarefa? Os arquivos do projeto não são alterados.')) deleteSession(s.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full">
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {!activeProjectId ? (
              <div className="text-center text-slate-400 text-sm mt-20 space-y-2">
                <Bot className="w-10 h-10 mx-auto text-purple-accent" />
                <p>Escolha um projeto para o agente trabalhar.</p>
                <p className="text-xs text-slate-500">Cadastre projetos na aba Projects.</p>
              </div>
            ) : !session || session.timeline.length === 0 ? (
              <div className="text-center text-slate-400 text-sm mt-20 space-y-3">
                <Bot className="w-10 h-10 mx-auto text-purple-accent" />
                <p className="text-slate-200 font-medium">Agente em {activeProject?.name}</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Descreva o que você quer. O agente explora o projeto, lê os arquivos que precisar e aplica as alterações
                  direto no disco. Cada edição pode ser desfeita pela timeline.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-xl mx-auto">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput(s);
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1.5 rounded-full border border-[#2f2858] bg-[#110f24] text-[11px] text-slate-300 hover:border-purple-600/60 hover:text-purple-200"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              session.timeline.map(item => (
                <TimelineEntry key={item.id} item={item} canRevert={!running} onRevert={revert} onApprove={approve} />
              ))
            )}
            {running && (
              session?.timeline.some(t => t.kind === 'tool' && t.status === 'awaiting') ? (
                <div className="pl-10 flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Aguardando sua aprovação…
                </div>
              ) : (
                <div className="pl-10 flex items-center gap-2 text-xs text-purple-300">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Trabalhando…
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {error && (
          <div className="mx-4 md:mx-8 mb-2 max-w-4xl md:mx-auto w-auto flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-rose-950/80 border border-rose-800/70 text-rose-200 text-xs">
            <span>{error}</span>
            <button onClick={clearError}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="px-4 md:px-8 pb-5">
          <div className="max-w-4xl mx-auto rounded-2xl border border-[#272445] bg-[#0f0d1d] focus-within:border-purple-700/60">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={!activeProjectId}
              rows={3}
              placeholder={activeProjectId ? 'Ex.: "adicione validação de e-mail no cadastro e ajuste os testes"' : 'Selecione um projeto'}
              className="w-full bg-transparent resize-none px-4 pt-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
            <div className="flex items-center gap-2 px-3 pb-3">
              <button
                onClick={() => setThink(t => !t)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono ${
                  think ? 'bg-purple-950/90 text-purple-300 border border-purple-700/60' : 'bg-[#141226] text-slate-500 border border-[#272445]'
                }`}
                title="Raciocínio estendido (modelos com suporte, ex.: qwen3). Mais lento, costuma errar menos."
              >
                <Brain className="w-3.5 h-3.5" />
                Pensar
              </button>
              <span className="text-[11px] text-slate-500 font-mono truncate">{selectedModel || 'sem modelo'}</span>
              <div className="flex-1" />
              {running ? (
                <button onClick={stop} className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white" title="Parar o agente">
                  <Square className="w-4 h-4 fill-white" />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={!input.trim() || !activeProjectId}
                  className="p-2 rounded-xl bg-gradient-to-r from-[#6d28d9] to-[#8b5cf6] disabled:opacity-30 text-white"
                  title="Enviar (Enter)"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
