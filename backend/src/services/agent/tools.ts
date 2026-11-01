import { Workspace, ToolError, FileChange } from './workspace.js';

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

export interface ToolContext {
  workspace: Workspace;
  /** Arquivo -> mtime da última leitura (compartilhado com a sessão) */
  fileReads: Record<string, number>;
}

export interface ToolOutcome {
  /** Texto devolvido ao modelo */
  output: string;
  /** Resumo curto para a timeline */
  summary: string;
  change?: FileChange;
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

    default:
      throw new ToolError(`Ferramenta desconhecida: ${name}. Disponíveis: ${AGENT_TOOLS.map(t => t.function.name).join(', ')}`);
  }
}
