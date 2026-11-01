import { Workspace, ToolError, FileChange } from './workspace.js';
import { runShellCommand } from './command-runner.js';

/** Definições no formato de tool calling do Ollama (compatível com OpenAI). */
export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and folders of a project directory as an indented tree. Ignored folders (node_modules, dist, .git...) are skipped.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory relative to the project root. Default: "." (root).' },
          depth: { type: 'integer', description: 'How many levels to expand (1-4). Default: 2.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a text file. Returns lines prefixed with their line number and a TAB. Up to 400 lines per call; use start_line to read further. You MUST read a file before editing it.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to the project root.' },
          start_line: { type: 'integer', description: 'First line to read (1-based). Default: 1.' },
          end_line: { type: 'integer', description: 'Last line to read (inclusive).' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search file contents across the project. Returns "path:line: text" for each match. Use it to find where functions, variables or strings are defined and used.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Text to search for (literal by default).' },
          path: { type: 'string', description: 'Limit the search to this file or folder.' },
          regex: { type: 'boolean', description: 'Treat pattern as a JavaScript regular expression.' },
          case_sensitive: { type: 'boolean', description: 'Default: false.' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files by name pattern, gitignore-style (e.g. "*.ts", "src/**/*.tsx", "package.json").',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'File name pattern.' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace an exact snippet in an existing file. old_string must match the file exactly (same indentation, WITHOUT the line-number prefix from read_file) and be unique, unless replace_all is true. Prefer several small edits over rewriting files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to the project root.' },
          old_string: { type: 'string', description: 'Exact text to replace, with enough surrounding lines to be unique.' },
          new_string: { type: 'string', description: 'Replacement text.' },
          replace_all: { type: 'boolean', description: 'Replace every occurrence. Default: false.' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create a new file, or completely overwrite an existing one (read it first). Always write the COMPLETE content; never use placeholders like "// rest of the code".',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to the project root.' },
          content: { type: 'string', description: 'Full file content.' },
        },
        required: ['path', 'content'],
      },
    },
  },
];

export const RUN_COMMAND_TOOL = {
  type: 'function',
  function: {
    name: 'run_command',
    description: 'Run a shell command in the project folder to build, test or lint (e.g. "npm run build", "msbuild Driver.sln /p:Configuration=Debug", "cmake --build build"). The user must approve each command. Returns the exit code and the output (start and end). Do NOT use it to edit, move or delete files, install system software, or load/start drivers or services.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command line to run.' },
        cwd: { type: 'string', description: 'Subfolder to run in, relative to the project root. Default: project root.' },
        timeout_seconds: { type: 'integer', description: 'Max run time (10-600). Default: 120.' },
      },
      required: ['command'],
    },
  },
};

export const SEARCH_KNOWLEDGE_TOOL = {
  type: 'function',
  function: {
    name: 'search_knowledge',
    description: "Search the user's knowledge base (books, docs, manuals indexed by the user) for reference material. Use it to check APIs, rules and concepts before making claims about them, and cite the source and page in your answer.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to look for, in natural language or exact identifiers.' },
        collection: { type: 'string', description: 'Optional collection name to restrict the search.' },
      },
      required: ['query'],
    },
  },
};

export type ApprovalDecision = 'approved' | 'auto_approved' | 'denied';

export interface KnowledgeHit {
  sourceTitle: string;
  pageNumber?: number;
  chapter?: string;
  filePath?: string;
  score: number;
  text: string;
}

export interface ToolContext {
  workspace: Workspace;
  /** Arquivo -> mtime da última leitura (compartilhado com a sessão) */
  fileReads: Record<string, number>;
  signal?: AbortSignal;
  /** Pede aprovação ao usuário para um comando; ausente = comandos desabilitados */
  requestApproval?: (command: string, cwd: string) => Promise<ApprovalDecision>;
  /** Busca na base de conhecimento; ausente = sem base ativa */
  searchKnowledge?: (query: string, collection?: string) => Promise<{ hits: KnowledgeHit[]; collections: string[] }>;
}

/** Formata os trechos da base de conhecimento para o modelo, com a fonte de cada um. */
export function formatKnowledgeHits(hits: KnowledgeHit[], collections: string[]): string {
  if (hits.length === 0) {
    return 'Nada relevante encontrado na base de conhecimento.' +
      (collections.length ? ` Coleções consultadas: ${collections.join(', ')}. Tente outros termos.` : '');
  }
  const blocks = hits.map((hit, idx) => {
    const meta = [
      hit.pageNumber ? `p.${hit.pageNumber}` : '',
      hit.chapter ? `"${hit.chapter}"` : '',
      hit.filePath || '',
    ].filter(Boolean).join(', ');
    const text = hit.text.length > 1_500 ? `${hit.text.slice(0, 1_500)}…` : hit.text;
    return `[${idx + 1}] ${hit.sourceTitle}${meta ? ` (${meta})` : ''} · ${Math.round(hit.score * 100)}%\n${text}`;
  });
  return `Coleções consultadas: ${collections.join(', ') || '(todas)'}\n\n${blocks.join('\n\n---\n\n')}`;
}

export interface ToolOutcome {
  /** Texto devolvido ao modelo */
  output: string;
  /** Resumo curto para a timeline */
  summary: string;
  change?: FileChange;
  /** Comando executado mas terminou com erro (para destacar na interface) */
  commandFailed?: boolean;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));
const int = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.floor(n) : undefined;
};
const bool = (v: unknown): boolean => v === true || v === 'true';
const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');

async function assertFreshRead(ctx: ToolContext, relPath: string): Promise<void> {
  const key = normalizePath(relPath);
  const readAt = ctx.fileReads[key];
  if (readAt === undefined) {
    throw new ToolError(`Leia ${key} com read_file antes de editá-lo.`);
  }
  const current = await ctx.workspace.mtime(key);
  if (current !== null && Math.abs(current - readAt) > 1) {
    throw new ToolError(`${key} mudou desde a última leitura. Leia novamente com read_file antes de editar.`);
  }
}

async function rememberWrite(ctx: ToolContext, relPath: string): Promise<void> {
  const key = normalizePath(relPath);
  const mtime = await ctx.workspace.mtime(key);
  if (mtime !== null) ctx.fileReads[key] = mtime;
}

export async function executeTool(ctx: ToolContext, name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  const { workspace } = ctx;

  switch (name) {
    case 'list_dir': {
      const target = str(args.path) || '.';
      const depth = Math.min(4, Math.max(1, int(args.depth) ?? 2));
      const output = await workspace.listDir(target, depth);
      return { output, summary: `Listou ${target === '.' ? 'a raiz do projeto' : target}` };
    }

    case 'read_file': {
      const target = normalizePath(str(args.path));
      const result = await workspace.readFile(target, int(args.start_line), int(args.end_line));
      ctx.fileReads[target] = result.mtimeMs;
      const range = args.start_line || args.end_line ? ` (linhas ${int(args.start_line) ?? 1}-${int(args.end_line) ?? '…'})` : '';
      return { output: result.text, summary: `Leu ${target}${range} · ${result.totalLines} linhas` };
    }

    case 'grep': {
      const pattern = str(args.pattern);
      const output = await workspace.grep(pattern, {
        path: str(args.path) || undefined,
        regex: bool(args.regex),
        caseSensitive: bool(args.case_sensitive),
      });
      const hits = output.startsWith('Nenhuma') ? 0 : output.split('\n').filter(l => !l.startsWith('...')).length;
      return { output, summary: `Buscou "${pattern}" · ${hits} ocorrência(s)` };
    }

    case 'glob': {
      const pattern = str(args.pattern);
      const output = await workspace.glob(pattern);
      const hits = output.startsWith('Nenhum') ? 0 : output.split('\n').filter(l => !l.startsWith('...')).length;
      return { output, summary: `Procurou arquivos "${pattern}" · ${hits} encontrado(s)` };
    }

    case 'edit_file': {
      const target = normalizePath(str(args.path));
      await assertFreshRead(ctx, target);
      const change = await workspace.editFile(target, str(args.old_string), str(args.new_string), bool(args.replace_all));
      await rememberWrite(ctx, target);
      return { output: `Arquivo ${change.path} editado com sucesso.`, summary: `Editou ${change.path}`, change };
    }

    case 'write_file': {
      const target = normalizePath(str(args.path));
      if (typeof args.content !== 'string') throw new ToolError('O parâmetro "content" é obrigatório');
      const exists = (await workspace.mtime(target)) !== null;
      if (exists) await assertFreshRead(ctx, target);
      const change = await workspace.writeFile(target, args.content);
      await rememberWrite(ctx, target);
      return {
        output: `Arquivo ${change.path} ${change.before === null ? 'criado' : 'sobrescrito'} com sucesso.`,
        summary: `${change.before === null ? 'Criou' : 'Reescreveu'} ${change.path}`,
        change,
      };
    }

    case 'run_command': {
      if (!ctx.requestApproval) {
        throw new ToolError('Execução de comandos está desabilitada neste PurpleAI (ALLOW_SHELL_COMMANDS=false).');
      }
      const command = str(args.command).trim();
      if (!command) throw new ToolError('O parâmetro "command" é obrigatório');
      const cwdRel = normalizePath(str(args.cwd));
      const cwdAbs = cwdRel ? await workspace.resolveDirectory(cwdRel) : workspace.root;
      const timeoutSeconds = Math.min(600, Math.max(10, int(args.timeout_seconds) ?? 120));

      const decision = await ctx.requestApproval(command, cwdRel || '.');
      if (decision === 'denied') {
        throw new ToolError('O usuário recusou este comando. Não tente de novo; siga sem ele ou pergunte ao usuário.');
      }

      const result = await runShellCommand(command, { cwd: cwdAbs, timeoutMs: timeoutSeconds * 1000, signal: ctx.signal });
      const status = result.timedOut
        ? `interrompido após ${timeoutSeconds}s (timeout)`
        : result.aborted
          ? 'cancelado'
          : `exit code ${result.exitCode}`;
      const where = cwdRel ? ` (em ${cwdRel})` : '';
      return {
        output: `$ ${command}${where}\n[${status} · ${(result.durationMs / 1000).toFixed(1)}s]\n\n${result.output || '(sem saída)'}`,
        summary: `Executou "${command}" · ${result.exitCode === 0 ? 'sucesso' : status}`,
        commandFailed: result.exitCode !== 0,
      };
    }

    case 'search_knowledge': {
      if (!ctx.searchKnowledge) throw new ToolError('Não há base de conhecimento ativa.');
      const query = str(args.query).trim();
      if (!query) throw new ToolError('O parâmetro "query" é obrigatório');
      const collection = str(args.collection).trim() || undefined;
      const { hits, collections } = await ctx.searchKnowledge(query, collection);
      return {
        output: formatKnowledgeHits(hits, collections),
        summary: `Consultou a base "${query}" · ${hits.length} trecho(s)${collections.length ? ` em ${collections.join(', ')}` : ''}`,
      };
    }

    default:
      throw new ToolError(`Ferramenta desconhecida: ${name}. Disponíveis: ${[...AGENT_TOOLS, RUN_COMMAND_TOOL, SEARCH_KNOWLEDGE_TOOL].map(t => t.function.name).join(', ')}`);
  }
}
