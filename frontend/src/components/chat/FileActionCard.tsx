import React, { useState, useMemo } from 'react';
import { FileCode2, Copy, Check, Save, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import hljs from 'highlight.js';
import { api } from '../../services/api';

interface FileActionCardProps {
  filePath: string;
  language?: string;
  code: string;
  activeProjectId?: string | null;
  onApplySuccess?: (filePath: string) => void;
}

export const FileActionCard: React.FC<FileActionCardProps> = ({
  filePath,
  language,
  code,
  activeProjectId,
  onApplySuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const cleanLang = useMemo(() => {
    if (!language) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext === 'ts' || ext === 'tsx') return 'typescript';
      if (ext === 'js' || ext === 'jsx') return 'javascript';
      if (ext === 'rs') return 'rust';
      if (ext === 'py') return 'python';
      if (ext === 'c' || ext === 'h') return 'c';
      if (ext === 'cpp' || ext === 'hpp') return 'cpp';
      if (ext === 'json') return 'json';
      return 'text';
    }
    const l = language.toLowerCase().trim();
    if (l === 'ts') return 'typescript';
    if (l === 'js') return 'javascript';
    if (l === 'py') return 'python';
    if (l === 'c++') return 'cpp';
    return l;
  }, [language, filePath]);

  const highlightedCode = useMemo(() => {
    const codeToHighlight = code.replace(/\n$/, '');
    try {
      if (cleanLang && hljs.getLanguage(cleanLang)) {
        return hljs.highlight(codeToHighlight, { language: cleanLang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(codeToHighlight).value;
    } catch {
      return codeToHighlight
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }, [code, cleanLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleApply = async () => {
    if (!activeProjectId) {
      alert('Nenhum projeto ativo selecionado no momento. Selecione um projeto no topo para aplicar alterações diretamente no disco.');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      await api.saveProjectFile(activeProjectId, filePath, code);
      setSaveStatus('success');
      onApplySuccess?.(filePath);
      setTimeout(() => setSaveStatus('idle'), 4000);
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(err.message || 'Erro ao gravar arquivo no disco');
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-purple-800/40 bg-[#090814] shadow-xl shadow-purple-950/20 group">
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#121025] border-b border-[#252048] gap-2 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-purple-900/40 border border-purple-700/50 flex items-center justify-center text-purple-300 shrink-0">
            <FileCode2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-mono font-medium text-slate-200 truncate" title={filePath}>
            {filePath}
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#1e1b38] text-purple-300 border border-purple-800/30 hidden sm:inline">
            {cleanLang}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg transition-all duration-150 ${
              copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-100 hover:bg-[#1e1b38] border border-transparent'
            }`}
            title="Copiar código"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>

          {activeProjectId ? (
            <button
              onClick={handleApply}
              disabled={saving || saveStatus === 'success'}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-all duration-150 ${
                saveStatus === 'success'
                  ? 'bg-emerald-600/90 text-white shadow-md shadow-emerald-950/40 border border-emerald-500'
                  : saveStatus === 'error'
                  ? 'bg-rose-600/80 text-white border border-rose-500'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/40 active:scale-95'
              } disabled:opacity-75`}
              title="Salvar alterações no disco do projeto"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Aplicando...</span>
                </>
              ) : saveStatus === 'success' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aplicado no disco!</span>
                </>
              ) : saveStatus === 'error' ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Falha ao salvar</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Aplicar Alteração</span>
                </>
              )}
            </button>
          ) : (
            <span
              className="text-[11px] text-slate-500 italic px-2 py-0.5 rounded bg-[#151329] border border-[#262247]"
              title="Selecione um projeto no chat para aplicar este arquivo com 1 clique"
            >
              Sem projeto ativo
            </span>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="px-4 py-2 bg-rose-950/50 border-b border-rose-900/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="p-4 overflow-x-auto text-sm font-mono leading-relaxed selection:bg-purple-900/60 selection:text-white max-h-96 overflow-y-auto">
        <pre className="m-0 p-0">
          <code
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
            className={`hljs language-${cleanLang}`}
          />
        </pre>
      </div>
    </div>
  );
};
