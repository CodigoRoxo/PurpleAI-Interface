import React, { useState } from 'react';
import {
  Activity,
  Terminal,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldAlert,
} from 'lucide-react';
import { RAGDebugTrace, TestResult, RAGDebugChunk } from '../../types/knowledge';

interface KnowledgeDebugViewProps {
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

export const KnowledgeDebugView: React.FC<KnowledgeDebugViewProps> = ({
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
  const [query, setQuery] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>({});

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onExecuteDebug(query.trim());
    }
  };

  const handlePreset = (presetQuery: string) => {
    setQuery(presetQuery);
    onExecuteDebug(presetQuery);
  };

  const toggleChunk = (id: string) => {
    setExpandedChunks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyPrompt = () => {
    if (!debugTrace) return;
    navigator.clipboard.writeText(debugTrace.prompt.systemDirective);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.65) return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
    if (score >= 0.40) return 'text-amber-400 bg-amber-950/60 border-amber-800/60';
    return 'text-slate-400 bg-slate-900/60 border-slate-700/60';
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-[#0d0b1a]/85 border border-purple-900/40 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-950/90 border border-purple-800/60 flex items-center justify-center">
              <Activity className="w-4 h-4 text-purple-accent animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Knowledge Debug & Pipeline Inspector</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700/50">
                  Observabilidade RAG
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Audite e inspecione o fluxo exato: Pergunta → Embedding → Busca Vetorial → Chunks → Prompt Final → Ollama.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onRunSanity}
              disabled={testingSanity}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/60 text-xs font-mono transition-all disabled:opacity-50"
              title="Executa teste de sanidade PURPLEAI_RAG_TEST (VIOLET-7429)"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{testingSanity ? 'Testando...' : '🧪 Teste Sanidade'}</span>
            </button>

            <button
              onClick={onRunNegative}
              disabled={testingNegative}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900/90 text-rose-300 border border-rose-700/60 text-xs font-mono transition-all disabled:opacity-50"
              title="Executa teste negativo para VIOLET-9999 (garante que não há alucinação de fontes)"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{testingNegative ? 'Testando...' : '⛔ Teste Negativo'}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Digite uma query para diagnosticar (ou selecione um preset abaixo)..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#121024] border border-[#2e2954] rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-purple-500 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={debugging || !query.trim()}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-950/50 disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {debugging ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <Terminal className="w-4 h-4" />
            )}
            <span>Diagnosticar</span>
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] text-slate-400">
          <span className="font-mono text-slate-500">Presets técnicos:</span>
          <button
            type="button"
            onClick={() => handlePreset('Qual é o código secreto?')}
            className="px-2.5 py-1 rounded-lg bg-[#16142a] hover:bg-purple-950/50 hover:text-purple-300 border border-[#29244a] transition-colors"
          >
            🔑 Código Secreto
          </button>
          <button
            type="button"
            onClick={() => handlePreset('Qual é o código secreto VIOLET-9999?')}
            className="px-2.5 py-1 rounded-lg bg-[#16142a] hover:bg-purple-950/50 hover:text-purple-300 border border-[#29244a] transition-colors"
          >
            ⛔ Negativo VIOLET-9999
          </button>
          <button
            type="button"
            onClick={() => handlePreset('Como funciona a rotina DriverEntry e o IRP_MJ_DEVICE_CONTROL no Windows?')}
            className="px-2.5 py-1 rounded-lg bg-[#16142a] hover:bg-purple-950/50 hover:text-purple-300 border border-[#29244a] transition-colors"
          >
            📖 DriverEntry & IRP
          </button>
          <button
            type="button"
            onClick={() => handlePreset('Explique a estrutura da PFN Database e a transição entre Standby e Modified List.')}
            className="px-2.5 py-1 rounded-lg bg-[#16142a] hover:bg-purple-950/50 hover:text-purple-300 border border-[#29244a] transition-colors"
          >
            🧠 PFN Database Memory
          </button>
        </div>
      </div>

      {sanityResult && (
        <div className={`p-4 rounded-xl border ${
          sanityResult.passed
            ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
            : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
        } space-y-2`}>
          <div className="flex items-center gap-2 font-bold text-xs">
            {sanityResult.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>Resultado do Teste de Sanidade: {sanityResult.passed ? 'APROVADO' : 'REPROVADO'}</span>
          </div>
          <p className="text-xs font-mono text-slate-300">{sanityResult.details}</p>
          <div className="text-[11px] font-mono bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-1">
            <div>Fonte Recuperada: <span className="text-purple-300">{sanityResult.retrievedSource}</span> (Score: {(sanityResult.score ? sanityResult.score * 100 : 0).toFixed(1)}%)</div>
            <div>Resposta da IA: <span className="text-slate-200 italic">"{sanityResult.modelResponse}"</span></div>
          </div>
        </div>
      )}

      {negativeResult && (
        <div className={`p-4 rounded-xl border ${
          negativeResult.passed
            ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
            : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
        } space-y-2`}>
          <div className="flex items-center gap-2 font-bold text-xs">
            {negativeResult.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>Resultado do Teste Negativo: {negativeResult.passed ? 'APROVADO (Sem Alucinação)' : 'REPROVADO (Alucinou Informação)'}</span>
          </div>
          <p className="text-xs font-mono text-slate-300">{negativeResult.details}</p>
          <div className="text-[11px] font-mono bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-1">
            <div>Fontes Avaliadas: <span className="text-slate-400">{negativeResult.retrievedSources?.join(', ') || 'Nenhuma'}</span></div>
            <div>Resposta da IA: <span className="text-slate-200 italic">"{negativeResult.modelResponse}"</span></div>
          </div>
        </div>
      )}

      {debugTrace && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0c0a18]/80 border border-[#232042]">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>Embedding Latency</span>
              </div>
              <span className="text-base font-bold font-mono text-purple-300">
                {debugTrace.embedding.latencyMs} ms
              </span>
              <span className="text-[10px] text-slate-500 block">
                {debugTrace.embedding.dimensions} dimensões
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c0a18]/80 border border-[#232042]">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Busca Vetorial</span>
              </div>
              <span className="text-base font-bold font-mono text-cyan-300">
                {debugTrace.retrieval.latencyMs} ms
              </span>
              <span className="text-[10px] text-slate-500 block">
                {debugTrace.retrieval.chunksEvaluated} chunks avaliados
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c0a18]/80 border border-[#232042]">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Chunks Recuperados</span>
              </div>
              <span className="text-base font-bold font-mono text-emerald-300">
                {debugTrace.retrieval.chunks.length} chunks
              </span>
              <span className="text-[10px] text-slate-500 block">
                limiar: &ge; {debugTrace.retrieval.minScoreThreshold}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c0a18]/80 border border-[#232042]">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                <Cpu className="w-3.5 h-3.5 text-pink-400" />
                <span>Contexto Injetado</span>
              </div>
              <span className="text-base font-bold font-mono text-pink-300">
                ~{debugTrace.prompt.estimatedContextTokens} tokens
              </span>
              <span className="text-[10px] text-slate-500 block">
                {debugTrace.generation ? `${debugTrace.generation.latencyMs}ms inferência` : 'Apenas prompt'}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#232042] bg-[#0c0a18]/80 backdrop-blur-md overflow-hidden">
            <div className="p-4 border-b border-[#1c1a32] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-mono border border-purple-800/50">
                  ESTÁGIO 2
                </span>
                <h3 className="text-xs font-bold text-slate-200">
                  Chunks Recuperados na Ordem de Injeção ({debugTrace.retrieval.chunks.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Ordenado por Similaridade de Cosseno Decrescente
              </span>
            </div>

            {debugTrace.retrieval.chunks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Nenhum chunk superou a pontuação mínima de {debugTrace.retrieval.minScoreThreshold}. O LLM não receberá contexto injetado para esta consulta.
              </div>
            ) : (
              <div className="divide-y divide-[#1a182e]">
                {debugTrace.retrieval.chunks.map((chunk: RAGDebugChunk) => {
                  const isExpanded = expandedChunks[chunk.id] !== false;
                  const scorePercent = (chunk.score * 100).toFixed(1);

                  return (
                    <div key={chunk.id} className="p-4 space-y-3 hover:bg-[#110f22]/40 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-md bg-purple-900/40 border border-purple-700/50 flex items-center justify-center text-xs font-mono font-bold text-purple-300">
                            #{chunk.rank}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-semibold text-slate-200">
                                {chunk.sourceTitle}
                              </h4>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getScoreColor(chunk.score)}`}>
                                Cosseno: {scorePercent}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                              {chunk.pageNumber && <span>Pág. {chunk.pageNumber}</span>}
                              {chunk.chapter && <span>· {chunk.chapter}</span>}
                              {chunk.filePath && <span>· {chunk.filePath}</span>}
                              {chunk.startLine && <span>· L{chunk.startLine}-L{chunk.endLine}</span>}
                              {chunk.language && <span className="text-purple-400">· [{chunk.language}]</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span className="text-[10px] text-slate-500 font-mono">
                            ~{chunk.estimatedTokens} tokens ({chunk.characterCount} chars)
                          </span>
                          <button
                            onClick={() => toggleChunk(chunk.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-200"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-3 rounded-xl bg-[#07050d] border border-[#232042] text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-60 overflow-y-auto">
                          {chunk.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#232042] bg-[#0c0a18]/80 backdrop-blur-md overflow-hidden">
            <div className="p-4 border-b border-[#1c1a32] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-pink-950 text-pink-300 text-[10px] font-mono border border-pink-800/50">
                  ESTÁGIO 3
                </span>
                <h3 className="text-xs font-bold text-slate-200">
                  Diretiva de Sistema & Prompt Final Montado
                </h3>
              </div>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-mono px-2 py-1 rounded hover:bg-purple-950/40 transition-colors"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPrompt ? 'Copiado!' : 'Copiar Prompt'}</span>
              </button>
            </div>
            <div className="p-4">
              <div className="p-3.5 rounded-xl bg-[#07050d] border border-[#232042] text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {debugTrace.prompt.systemDirective}
              </div>
            </div>
          </div>

          {debugTrace.generation && (
            <div className="rounded-2xl border border-[#232042] bg-[#0c0a18]/80 backdrop-blur-md overflow-hidden">
              <div className="p-4 border-b border-[#1c1a32] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-mono border border-emerald-800/50">
                    ESTÁGIO 4
                  </span>
                  <h3 className="text-xs font-bold text-slate-200">
                    Resposta Gerada pelo Modelo ({debugTrace.generation.model})
                  </h3>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono">
                  Gerado em {debugTrace.generation.latencyMs} ms
                </span>
              </div>
              <div className="p-4">
                <div className="p-4 rounded-xl bg-[#090714] border border-[#28224d] text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                  {debugTrace.generation.response}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
