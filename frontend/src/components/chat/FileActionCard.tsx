import React, { useState, useMemo } from 'react';
import { FileCode2, Copy, Check, Save, RefreshCw, AlertCircle, CheckCircle2, GitCommit, Split } from 'lucide-react';
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
  const [successMessage, setSuccessMessage] = useState('Salvo no disco!');
  const [errorMessage, setErrorMessage] = useState('');
  const [diffTab, setDiffTab] = useState<'diff' | 'raw' | 'replace'>('diff');

  const cleanLang = useMemo(() => {
    if (!language || language === 'diff' || language === 'patch') {
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

  const diffBlocks = useMemo(() => {
    const regex = /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g;
    const blocks: Array<{ search: string; replace: string }> = [];
    let match;
    while ((match = regex.exec(code)) !== null) {
      blocks.push({
        search: match[1],
        replace: match[2],
      });
    }
    return blocks;
  }, [code]);

  const isDiffMode = diffBlocks.length > 0;
  const combinedReplaceCode = useMemo(() => {
    if (!isDiffMode) return code;
    return diffBlocks.map(b => b.replace).join('\n\n');
  }, [isDiffMode, diffBlocks, code]);

  const highlightedCode = useMemo(() => {
    const codeToHighlight = (diffTab === 'replace' ? combinedReplaceCode : code).replace(/\n$/, '');
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
  }, [code, cleanLang, diffTab, combinedReplaceCode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(isDiffMode ? combinedReplaceCode : code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleApplyPatch = async () => {
    if (!activeProjectId) {
      alert('Nenhum projeto ativo selecionado. Selecione um projeto no topo para aplicar alterações no disco.');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      if (isDiffMode) {
        for (const block of diffBlocks) {
          await api.applyProjectPatch(activeProjectId, filePath, block.search, block.replace, false);
        }
        setSuccessMessage('Patch cirúrgico aplicado com sucesso!');
      } else {
        await api.saveProjectFile(activeProjectId, filePath, code);
        setSuccessMessage('Arquivo completo salvo no disco com backup .bak!');
      }
      setSaveStatus('success');
      onApplySuccess?.(filePath);
      setTimeout(() => setSaveStatus('idle'), 4000);
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(err.message || 'Erro ao aplicar patch no arquivo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-purple-800/40 bg-[#090814] shadow-xl shadow-purple-950/20 group">
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#121025] border-b border-[#252048] gap-2 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-purple-900/40 border border-purple-700/50 flex items-center justify-center text-purple-300 shrink-0">
            {isDiffMode ? <GitCommit className="w-3.5 h-3.5 text-amber-400" /> : <FileCode2 className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-mono font-medium text-slate-200 truncate" title={filePath}>
            {filePath}
          </span>
          {isDiffMode ? (
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 font-semibold flex items-center gap-1">
              <span>Diff ({diffBlocks.length} {diffBlocks.length === 1 ? 'bloco' : 'blocos'})</span>
            </span>
          ) : (
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#1e1b38] text-purple-300 border border-purple-800/30 hidden sm:inline">
              {cleanLang}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDiffMode && (
            <div className="flex items-center bg-[#0d0b1a] rounded-lg p-0.5 border border-[#231f40] mr-1">
              <button
                onClick={() => setDiffTab('diff')}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  diffTab === 'diff' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Visual Diff
              </button>
              <button
                onClick={() => setDiffTab('replace')}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  diffTab === 'replace' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Novo Código
              </button>
              <button
                onClick={() => setDiffTab('raw')}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  diffTab === 'raw' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bruto
              </button>
            </div>
          )}

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
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleApplyPatch}
                disabled={saving || saveStatus === 'success'}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-all duration-150 ${
                  saveStatus === 'success'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 border border-emerald-500'
                    : saveStatus === 'error'
                    ? 'bg-rose-600 text-white border border-rose-500'
                    : isDiffMode
                    ? 'bg-gradient-to-r from-amber-600 to-purple-600 hover:from-amber-500 hover:to-purple-500 text-white shadow-md shadow-amber-950/40 active:scale-95 font-medium'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/40 active:scale-95'
                } disabled:opacity-75`}
                title={isDiffMode ? "Tenta aplicar a substituição cirúrgica nos blocos" : "Salvar arquivo completo no disco com backup .bak"}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Aplicando...</span>
                  </>
                ) : saveStatus === 'success' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{successMessage}</span>
                  </>
                ) : saveStatus === 'error' ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Falha no Patch</span>
                  </>
                ) : (
                  <>
                    {isDiffMode ? <Split className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isDiffMode ? 'Aplicar Patch Cirúrgico' : 'Salvar Arquivo Completo'}</span>
                  </>
                )}
              </button>
            </div>
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
        <div className="px-4 py-3 bg-rose-950/70 border-b border-rose-900/60 text-rose-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-rose-300">{errorMessage}</div>
            <div className="text-[11px] text-rose-300/80 mt-1 leading-relaxed">
              O modelo gerou um bloco SEARCH com comentários de resumo ou espaçamento diferente do arquivo real.
              <span className="block mt-1 text-purple-300 font-medium">
                💡 Peça no chat: &quot;Forneça o arquivo {filePath} completo atualizado&quot; para salvá-lo 100% de uma vez no disco com total estabilidade.
              </span>
            </div>
          </div>
        </div>
      )}

      {isDiffMode && diffTab === 'diff' ? (
        <div className="p-3 text-xs font-mono leading-relaxed space-y-3 max-h-96 overflow-y-auto">
          {diffBlocks.map((block, bIdx) => (
            <div key={bIdx} className="space-y-2 border border-[#201c3d] rounded-xl p-2.5 bg-[#080712]">
              {diffBlocks.length > 1 && (
                <div className="text-[10px] uppercase font-bold text-amber-400/80 mb-1">
                  Bloco de Modificação #{bIdx + 1}
                </div>
              )}
              <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-2.5 overflow-x-auto">
                <div className="text-[10px] uppercase font-bold text-rose-400 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Trecho a ser substituído (SEARCH):
                </div>
                <pre className="m-0 text-rose-200/90 whitespace-pre">
                  {block.search.split('\n').map((line, idx) => (
                    <div key={idx} className="flex">
                      <span className="text-rose-500/60 select-none mr-2">-</span>
                      <span>{line || ' '}</span>
                    </div>
                  ))}
                </pre>
              </div>

              <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-2.5 overflow-x-auto">
                <div className="text-[10px] uppercase font-bold text-emerald-400 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Novo código aplicado (REPLACE):
                </div>
                <pre className="m-0 text-emerald-200/90 whitespace-pre">
                  {block.replace.split('\n').map((line, idx) => (
                    <div key={idx} className="flex">
                      <span className="text-emerald-500/60 select-none mr-2">+</span>
                      <span>{line || ' '}</span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 overflow-x-auto text-sm font-mono leading-relaxed selection:bg-purple-900/60 selection:text-white max-h-96 overflow-y-auto">
          <pre className="m-0 p-0">
            <code
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
              className={`hljs language-${cleanLang}`}
            />
          </pre>
        </div>
      )}
    </div>
  );
};
