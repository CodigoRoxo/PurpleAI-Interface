import fs from 'fs/promises';
import path from 'path';
import ignore, { Ignore } from 'ignore';
import { resolvePathInRoot, isPathInside } from '../../utils/paths.js';

const MAX_READ_LINES = 400;
const MAX_READ_CHARS = 24_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_GREP_FILE_BYTES = 1024 * 1024;
const MAX_GREP_RESULTS = 80;
const MAX_LIST_ENTRIES = 300;
const MAX_GLOB_RESULTS = 200;

export class ToolError extends Error {}

export interface ReadResult {
  text: string;
  totalLines: number;
}

export interface FileChange {
  path: string;
  before: string | null;
  after: string;
}

/**
 * Operações de arquivo do agente, sempre confinadas à raiz do projeto
 * e respeitando os padrões de ignore do projeto.
 */
export class Workspace {
  private ig: Ignore;

  private constructor(readonly root: string, ignorePatterns: string[]) {
    this.ig = ignore().add(ignorePatterns);
  }

  static async open(root: string, ignorePatterns: string[]): Promise<Workspace> {
    return new Workspace(await fs.realpath(root), ignorePatterns);
  }

  toRelative(absPath: string): string {
    return path.relative(this.root, absPath).replace(/\\/g, '/');
  }

  private isIgnored(relPath: string, isDir: boolean): boolean {
    if (!relPath) return false;
    return this.ig.ignores(isDir ? `${relPath}/` : relPath);
  }

  private async resolveDir(relPath?: string): Promise<string> {
    const clean = (relPath || '').trim();
    if (clean === '' || clean === '.' || clean === './') return fs.realpath(this.root);
    const abs = await resolvePathInRoot(this.root, clean);
    const stat = await fs.stat(abs).catch(() => null);
    if (!stat?.isDirectory()) throw new ToolError(`Diretório não encontrado: ${clean}`);
    return abs;
  }

  private async resolveFile(relPath: string): Promise<string> {
    if (!relPath || !relPath.trim()) throw new ToolError('O parâmetro "path" é obrigatório');
    try {
      return await resolvePathInRoot(this.root, relPath.trim());
    } catch (err) {
      throw new ToolError(err instanceof Error ? err.message : String(err));
    }
  }

  async *walkFiles(startAbs: string): AsyncGenerator<string> {
    const entries = await fs.readdir(startAbs, { withFileTypes: true }).catch(() => []);
    entries.sort((x, y) => x.name.localeCompare(y.name));
    for (const entry of entries) {
      const abs = path.join(startAbs, entry.name);
      const rel = this.toRelative(abs);
      if (entry.isDirectory()) {
        if (this.isIgnored(rel, true)) continue;
        yield* this.walkFiles(abs);
      } else if (entry.isFile()) {
        if (this.isIgnored(rel, false)) continue;
        yield rel;
      }
    }
  }

  async listDir(relPath?: string, depth = 2): Promise<string> {
    const start = await this.resolveDir(relPath);
    const lines: string[] = [];
    let truncated = false;

    const walk = async (dir: string, level: number) => {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      entries.sort((x, y) => {
        if (x.isDirectory() !== y.isDirectory()) return x.isDirectory() ? -1 : 1;
        return x.name.localeCompare(y.name);
      });
      for (const entry of entries) {
        if (lines.length >= MAX_LIST_ENTRIES) {
          truncated = true;
          return;
        }
        const abs = path.join(dir, entry.name);
        const rel = this.toRelative(abs);
        const isDir = entry.isDirectory();
        if (this.isIgnored(rel, isDir)) continue;
        const indent = '  '.repeat(level);
        lines.push(`${indent}${entry.name}${isDir ? '/' : ''}`);
        if (isDir && level + 1 < depth) await walk(abs, level + 1);
      }
    };

    await walk(start, 0);
    if (lines.length === 0) return '(diretório vazio)';
    if (truncated) lines.push(`... (lista truncada em ${MAX_LIST_ENTRIES} itens; liste uma subpasta)`);
    return lines.join('\n');
  }

  /** Lê o arquivo inteiro (texto), recusando binários e arquivos enormes. */
  async readRaw(relPath: string): Promise<{ abs: string; content: string; mtimeMs: number } | null> {
    const abs = await this.resolveFile(relPath);
    const stat = await fs.stat(abs).catch(() => null);
    if (!stat) return null;
    if (!stat.isFile()) throw new ToolError(`Não é um arquivo: ${relPath}`);
    if (stat.size > MAX_FILE_BYTES) throw new ToolError(`Arquivo grande demais (${Math.round(stat.size / 1024)} KB)`);
    const buffer = await fs.readFile(abs);
    if (buffer.subarray(0, 8000).includes(0)) throw new ToolError(`Arquivo binário: ${relPath}`);
    return { abs, content: buffer.toString('utf-8'), mtimeMs: stat.mtimeMs };
  }

  async readFile(relPath: string, startLine?: number, endLine?: number): Promise<ReadResult & { mtimeMs: number }> {
    const raw = await this.readRaw(relPath);
    if (!raw) throw new ToolError(`Arquivo não encontrado: ${relPath}`);

    const lines = raw.content.replace(/\r\n/g, '\n').split('\n');
    const totalLines = lines.length;
    const start = Math.max(1, Math.floor(startLine || 1));
    let end = Math.min(totalLines, Math.floor(endLine || start + MAX_READ_LINES - 1));
    if (end - start + 1 > MAX_READ_LINES) end = start + MAX_READ_LINES - 1;

    const out: string[] = [];
    let chars = 0;
    let lastLine = start - 1;
    for (let n = start; n <= end; n++) {
      const line = `${String(n).padStart(5)}\t${lines[n - 1]}`;
      if (chars + line.length > MAX_READ_CHARS && out.length > 0) break;
      out.push(line);
      chars += line.length + 1;
      lastLine = n;
    }

    let text = out.join('\n');
    if (lastLine < totalLines) {
      text += `\n\n[Mostrando linhas ${start}-${lastLine} de ${totalLines}. Use start_line=${lastLine + 1} para continuar.]`;
    }
    return { text, totalLines, mtimeMs: raw.mtimeMs };
  }

  async grep(pattern: string, options: { path?: string; regex?: boolean; caseSensitive?: boolean } = {}): Promise<string> {
    if (!pattern) throw new ToolError('O parâmetro "pattern" é obrigatório');
    let matcher: RegExp;
    try {
      const source = options.regex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      matcher = new RegExp(source, options.caseSensitive ? '' : 'i');
    } catch (err) {
      throw new ToolError(`Regex inválida: ${err instanceof Error ? err.message : String(err)}`);
    }

    let startAbs: string;
    let singleFile: string | null = null;
    const target = options.path?.trim();
    if (target && target !== '.') {
      const abs = await this.resolveFile(target);
      const stat = await fs.stat(abs).catch(() => null);
      if (!stat) throw new ToolError(`Caminho não encontrado: ${target}`);
      if (stat.isFile()) singleFile = this.toRelative(abs);
      startAbs = abs;
    } else {
      startAbs = await fs.realpath(this.root);
    }

    const results: string[] = [];
    const files = singleFile ? [singleFile] : this.walkFiles(startAbs);
    for await (const rel of files) {
      const abs = path.join(this.root, rel);
      const stat = await fs.stat(abs).catch(() => null);
      if (!stat || stat.size > MAX_GREP_FILE_BYTES) continue;
      const buffer = await fs.readFile(abs).catch(() => null);
      if (!buffer || buffer.subarray(0, 8000).includes(0)) continue;

      const lines = buffer.toString('utf-8').split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (matcher.test(lines[i])) {
          results.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
          if (results.length >= MAX_GREP_RESULTS) {
            results.push(`... (limite de ${MAX_GREP_RESULTS} resultados; refine a busca ou use "path")`);
            return results.join('\n');
          }
        }
      }
    }
    return results.length > 0 ? results.join('\n') : 'Nenhuma ocorrência encontrada.';
  }

  async glob(pattern: string): Promise<string> {
    if (!pattern) throw new ToolError('O parâmetro "pattern" é obrigatório');
    const matcher = ignore().add(pattern);
    const results: string[] = [];
    for await (const rel of this.walkFiles(await fs.realpath(this.root))) {
      if (matcher.ignores(rel)) {
        results.push(rel);
        if (results.length >= MAX_GLOB_RESULTS) {
          results.push(`... (limite de ${MAX_GLOB_RESULTS} arquivos)`);
          break;
        }
      }
    }
    return results.length > 0 ? results.join('\n') : 'Nenhum arquivo encontrado.';
  }

  /**
   * Substitui um trecho exato. Aceita old_string copiado do read_file com os números
   * de linha (erro comum de modelos pequenos) removendo esse prefixo automaticamente.
   */
  async editFile(relPath: string, oldString: string, newString: string, replaceAll = false): Promise<FileChange> {
    const raw = await this.readRaw(relPath);
    if (!raw) throw new ToolError(`Arquivo não encontrado: ${relPath}. Para criar um arquivo novo use write_file.`);
    if (!oldString) throw new ToolError('old_string não pode ser vazio. Para reescrever o arquivo inteiro use write_file.');
    if (oldString === newString) throw new ToolError('old_string e new_string são iguais; nada a mudar.');

    const usesCrlf = raw.content.includes('\r\n');
    const content = raw.content.replace(/\r\n/g, '\n');
    let search = oldString.replace(/\r\n/g, '\n');
    let replacement = newString.replace(/\r\n/g, '\n');

    let count = countOccurrences(content, search);
    if (count === 0) {
      const lineNumberPrefix = /^\s*\d+\t/;
      const searchLines = search.split('\n');
      if (searchLines.every(l => lineNumberPrefix.test(l) || l === '')) {
        search = searchLines.map(l => l.replace(lineNumberPrefix, '')).join('\n');
        replacement = replacement.split('\n').map(l => l.replace(lineNumberPrefix, '')).join('\n');
        count = countOccurrences(content, search);
      }
    }

    if (count === 0) {
      throw new ToolError(
        `old_string não encontrado em ${relPath}. Releia o arquivo com read_file e copie o trecho exatamente ` +
        `(mesma indentação, sem os números de linha).`
      );
    }
    if (count > 1 && !replaceAll) {
      throw new ToolError(
        `old_string aparece ${count} vezes em ${relPath}. Inclua mais linhas de contexto para torná-lo único, ` +
        `ou use replace_all=true para trocar todas.`
      );
    }

    const updated = replaceAll ? content.split(search).join(replacement) : content.replace(search, () => replacement);
    const finalContent = usesCrlf ? updated.replace(/\n/g, '\r\n') : updated;
    await fs.writeFile(raw.abs, finalContent, 'utf-8');
    return { path: this.toRelative(raw.abs), before: raw.content, after: finalContent };
  }

  async writeFile(relPath: string, content: string): Promise<FileChange> {
    const abs = await this.resolveFile(relPath);
    const existing = await this.readRaw(relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const usesCrlf = existing?.content.includes('\r\n');
    const finalContent = usesCrlf ? content.replace(/\r?\n/g, '\r\n') : content;
    await fs.writeFile(abs, finalContent, 'utf-8');
    return { path: this.toRelative(abs), before: existing ? existing.content : null, after: finalContent };
  }

  /** Restaura um arquivo para um conteúdo anterior (ou apaga, se ele não existia). */
  async restore(relPath: string, content: string | null): Promise<void> {
    const abs = await resolvePathInRoot(this.root, relPath);
    if (!isPathInside(this.root, abs)) throw new ToolError('Caminho fora do projeto');
    if (content === null) {
      await fs.rm(abs, { force: true });
    } else {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, 'utf-8');
    }
  }

  async mtime(relPath: string): Promise<number | null> {
    const abs = await this.resolveFile(relPath);
    const stat = await fs.stat(abs).catch(() => null);
    return stat ? stat.mtimeMs : null;
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}
