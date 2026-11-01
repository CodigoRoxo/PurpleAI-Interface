import { spawn } from 'child_process';

const HEAD_CHARS = 1_500;
const TAIL_CHARS = 6_000;

export interface CommandResult {
  exitCode: number | null;
  output: string;
  timedOut: boolean;
  aborted: boolean;
  durationMs: number;
}

/** Mantém o começo e, principalmente, o fim da saída (onde ficam os erros de build). */
export function clipOutput(text: string): string {
  if (text.length <= HEAD_CHARS + TAIL_CHARS) return text;
  const omitted = text.length - HEAD_CHARS - TAIL_CHARS;
  return `${text.slice(0, HEAD_CHARS)}\n\n[... ${omitted} caracteres omitidos ...]\n\n${text.slice(-TAIL_CHARS)}`;
}

function killTree(pid: number): void {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // processo já terminou
  }
}

/**
 * Executa um comando no shell do sistema, juntando stdout e stderr na ordem em que chegam.
 * Encerra a árvore de processos inteira em caso de timeout ou cancelamento.
 */
export function runShellCommand(
  command: string,
  options: { cwd: string; timeoutMs: number; signal?: AbortSignal }
): Promise<CommandResult> {
  const started = Date.now();
  return new Promise(resolve => {
    const child = spawn(command, {
      cwd: options.cwd,
      shell: true,
      windowsHide: true,
      detached: process.platform !== 'win32',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });

    let output = '';
    let timedOut = false;
    let aborted = false;
    const append = (chunk: Buffer) => {
      output += chunk.toString('utf-8');
      // Evita estourar memória com saídas enormes: guarda só o necessário para clipOutput
      if (output.length > 4 * (HEAD_CHARS + TAIL_CHARS)) {
        output = output.slice(0, HEAD_CHARS) + '\n[...]\n' + output.slice(-TAIL_CHARS * 2);
      }
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);

    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) killTree(child.pid);
    }, options.timeoutMs);

    const onAbort = () => {
      aborted = true;
      if (child.pid) killTree(child.pid);
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      resolve({
        exitCode,
        output: clipOutput(output.replace(/\x1b\[[0-9;]*m/g, '')),
        timedOut,
        aborted,
        durationMs: Date.now() - started,
      });
    };
    child.on('error', err => {
      output += `\n${err.message}`;
      finish(null);
    });
    child.on('close', code => finish(code));
  });
}
