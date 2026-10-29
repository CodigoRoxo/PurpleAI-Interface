import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/** True se `target` é o próprio `root` ou está dentro dele (sem falso positivo de prefixo). */
export function isPathInside(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/** Remove qualquer componente de diretório de um nome de arquivo enviado pelo cliente. */
export function sanitizeFileName(name: string): string {
  const base = path.basename(name.replace(/\\/g, '/'));
  const clean = base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').trim();
  return clean && clean !== '.' && clean !== '..' ? clean : 'arquivo';
}

/**
 * Resolve `relativePath` dentro de `projectRoot`, seguindo symlinks do trecho que já existe
 * em disco, e recusa qualquer caminho que escape da raiz ou aponte para dentro de `.git`.
 */
export async function resolvePathInRoot(projectRoot: string, relativePath: string): Promise<string> {
  const root = await fs.realpath(projectRoot);
  const cleanRel = relativePath.replace(/^[/\\]+/, '');
  const target = path.resolve(root, cleanRel);

  if (!isPathInside(root, target) || target === root) {
    throw new Error('Acesso negado: Caminho fora do diretório raiz do projeto');
  }

  const firstSegment = path.relative(root, target).split(path.sep)[0];
  if (firstSegment.toLowerCase() === '.git') {
    throw new Error('Acesso negado: O diretório .git não pode ser acessado');
  }

  // Valida o ancestral mais profundo que já existe, para que um symlink não leve para fora da raiz
  let existing = target;
  for (;;) {
    try {
      const real = await fs.realpath(existing);
      if (!isPathInside(root, real)) {
        throw new Error('Acesso negado: Caminho fora do diretório raiz do projeto');
      }
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      const parent = path.dirname(existing);
      if (parent === existing) break;
      existing = parent;
    }
  }

  return target;
}

/** Recusa raízes amplas demais para servir de workspace (raiz do disco, pasta do usuário). */
export function assertReasonableProjectRoot(dirPath: string): void {
  const resolved = path.resolve(dirPath);
  if (path.parse(resolved).root === resolved) {
    throw new Error('A raiz do disco não pode ser usada como projeto. Escolha a pasta do projeto.');
  }
  if (path.relative(os.homedir(), resolved) === '') {
    throw new Error('A pasta do usuário não pode ser usada como projeto. Escolha a pasta do projeto.');
  }
}
