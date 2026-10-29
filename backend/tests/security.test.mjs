import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createSecurityGuard } from '../dist/middleware/security.js';
import { isPathInside, sanitizeFileName, resolvePathInRoot, assertReasonableProjectRoot } from '../dist/utils/paths.js';

function runGuard(guard, headers) {
  const req = { headers, header: name => headers[name.toLowerCase()] };
  let status = 200;
  let nextCalled = false;
  const res = {
    status(code) { status = code; return this; },
    json() { return this; },
  };
  guard(req, res, () => { nextCalled = true; });
  return { status: nextCalled ? 200 : status };
}

const localGuard = createSecurityGuard({
  allowedOrigins: ['http://localhost:3000'],
  allowedHosts: ['127.0.0.1', 'localhost', '::1'],
  apiToken: '',
});

test('Guard - aceita requisição local do frontend', () => {
  assert.equal(runGuard(localGuard, { host: 'localhost:3000', origin: 'http://localhost:3000' }).status, 200);
  assert.equal(runGuard(localGuard, { host: '127.0.0.1:3001' }).status, 200);
  assert.equal(runGuard(localGuard, { host: '[::1]:3001' }).status, 200);
});

test('Guard - bloqueia site de terceiros (CSRF)', () => {
  assert.equal(runGuard(localGuard, { host: 'localhost:3001', origin: 'https://evil.example' }).status, 403);
});

test('Guard - bloqueia DNS rebinding (Host estranho)', () => {
  assert.equal(runGuard(localGuard, { host: 'evil.example:3001' }).status, 403);
  assert.equal(runGuard(localGuard, {}).status, 403);
});

test('Guard - com token, exige o header correto', () => {
  const guard = createSecurityGuard({ allowedOrigins: [], allowedHosts: [], apiToken: 's3cret' });
  assert.equal(runGuard(guard, { host: '192.168.0.10:3001' }).status, 401);
  assert.equal(runGuard(guard, { host: '192.168.0.10:3001', 'x-purpleai-token': 'wrong!' }).status, 401);
  assert.equal(runGuard(guard, { host: '192.168.0.10:3001', 'x-purpleai-token': 's3cret' }).status, 200);
});

test('Paths - isPathInside não cai no falso positivo de prefixo', () => {
  const root = path.resolve('/projetos/app');
  assert.ok(isPathInside(root, path.join(root, 'src/index.ts')));
  assert.ok(!isPathInside(root, path.resolve('/projetos/app-evil/x.ts')));
  assert.ok(!isPathInside(root, path.resolve('/projetos/outro.ts')));
});

test('Paths - sanitizeFileName remove diretórios', () => {
  assert.equal(sanitizeFileName('../../../server.ts'), 'server.ts');
  assert.equal(sanitizeFileName('..\\..\\evil.bat'), 'evil.bat');
  assert.equal(sanitizeFileName('..'), 'arquivo');
});

test('Paths - resolvePathInRoot bloqueia traversal, prefixo irmão e .git', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'purpleai-sec-'));
  const root = path.join(base, 'app');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.mkdir(path.join(base, 'app-evil'), { recursive: true });

  try {
    const ok = await resolvePathInRoot(root, 'src/novo/arquivo.ts');
    assert.ok(ok.endsWith(path.join('src', 'novo', 'arquivo.ts')));

    await assert.rejects(resolvePathInRoot(root, '../app-evil/x.ts'), /Acesso negado/);
    await assert.rejects(resolvePathInRoot(root, '../../etc/passwd'), /Acesso negado/);
    await assert.rejects(resolvePathInRoot(root, '.git/hooks/pre-commit'), /\.git/);
    await assert.rejects(resolvePathInRoot(root, ''), /Acesso negado/);
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});

test('Paths - recusa raiz do disco e pasta do usuário como projeto', () => {
  assert.throws(() => assertReasonableProjectRoot(path.parse(process.cwd()).root), /raiz do disco/);
  assert.throws(() => assertReasonableProjectRoot(os.homedir()), /pasta do usuário/);
  assert.doesNotThrow(() => assertReasonableProjectRoot(path.join(os.homedir(), 'projetos', 'app')));
});
