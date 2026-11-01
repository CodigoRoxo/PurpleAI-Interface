import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// Dados isolados e Ollama apontando para uma porta morta: nenhum teste toca o modelo
const base = await fs.mkdtemp(path.join(os.tmpdir(), 'purpleai-agent-'));
process.env.AGENT_DIR = path.join(base, 'agent');
process.env.PROJECTS_DIR = path.join(base, 'projects');
process.env.KNOWLEDGE_DIR = path.join(base, 'knowledge');
process.env.DATA_DIR = path.join(base, 'conversations');
process.env.OLLAMA_HOST = 'http://127.0.0.1:9';

const { Workspace, ToolError } = await import('../dist/services/agent/workspace.js');
const { executeTool } = await import('../dist/services/agent/tools.js');
const { parseTextToolCalls, agentService } = await import('../dist/services/agent/agent.service.js');
const { agentStore } = await import('../dist/services/agent/agent.store.js');
const { projectService } = await import('../dist/services/project.service.js');
const { diffLines, countChanges } = await import('../dist/utils/diff.js');

async function makeProject() {
  const root = await fs.mkdtemp(path.join(base, 'proj-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.mkdir(path.join(root, 'node_modules', 'lib'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'math.ts'), 'export function sum(a: number, b: number) {\n  return a + b;\n}\n');
  await fs.writeFile(path.join(root, 'src', 'app.ts'), "import { sum } from './math';\n\nconsole.log(sum(1, 2));\n");
  await fs.writeFile(path.join(root, 'src', 'crlf.ts'), 'const a = 1;\r\nconst b = 2;\r\n');
  await fs.writeFile(path.join(root, 'node_modules', 'lib', 'index.js'), 'sum()');
  return root;
}

async function makeCtx(root) {
  const workspace = await Workspace.open(root, ['node_modules', '.git']);
  return { workspace, fileReads: {} };
}

test.after(() => fs.rm(base, { recursive: true, force: true }));

test('Workspace - list_dir, glob e grep ignoram node_modules', async () => {
  const ctx = await makeCtx(await makeProject());
  const tree = (await executeTool(ctx, 'list_dir', {})).output;
  assert.match(tree, /src\//);
  assert.doesNotMatch(tree, /node_modules/);

  const files = (await executeTool(ctx, 'glob', { pattern: '*.ts' })).output.split('\n');
  assert.deepEqual(files.sort(), ['src/app.ts', 'src/crlf.ts', 'src/math.ts']);

  const grep = (await executeTool(ctx, 'grep', { pattern: 'sum(' })).output;
  assert.match(grep, /src\/app\.ts:3:/);
  assert.match(grep, /src\/math\.ts:1:/);
  assert.doesNotMatch(grep, /node_modules/);
});

test('read_file - numera linhas e pagina arquivos longos', async () => {
  const root = await makeProject();
  await fs.writeFile(path.join(root, 'long.txt'), Array.from({ length: 1000 }, (_, i) => `linha ${i + 1}`).join('\n'));
  const ctx = await makeCtx(root);
  const out = (await executeTool(ctx, 'read_file', { path: 'long.txt' })).output;
  assert.match(out, /^\s+1\tlinha 1$/m);
  assert.match(out, /start_line=401/);
  const page = (await executeTool(ctx, 'read_file', { path: 'long.txt', start_line: 990 })).output;
  assert.match(page, /990\tlinha 990/);
});

test('edit_file - exige leitura prévia', async () => {
  const ctx = await makeCtx(await makeProject());
  await assert.rejects(
    executeTool(ctx, 'edit_file', { path: 'src/math.ts', old_string: 'a + b', new_string: 'a - b' }),
    /Leia src\/math\.ts/
  );
});

test('edit_file - troca exata, recusa ambiguidade e aceita prefixo de linha colado', async () => {
  const root = await makeProject();
  const ctx = await makeCtx(root);
  await executeTool(ctx, 'read_file', { path: 'src/math.ts' });

  const ok = await executeTool(ctx, 'edit_file', { path: 'src/math.ts', old_string: '  return a + b;', new_string: '  return a + b + 0;' });
  assert.equal(ok.change.path, 'src/math.ts');
  assert.match(await fs.readFile(path.join(root, 'src/math.ts'), 'utf-8'), /a \+ b \+ 0/);

  await executeTool(ctx, 'read_file', { path: 'src/app.ts' });
  await fs.appendFile(path.join(root, 'src/app.ts'), '');
  // modelo colou com o número de linha do read_file
  await executeTool(ctx, 'edit_file', { path: 'src/app.ts', old_string: '    3\tconsole.log(sum(1, 2));', new_string: 'console.log(sum(2, 3));' });
  assert.match(await fs.readFile(path.join(root, 'src/app.ts'), 'utf-8'), /sum\(2, 3\)/);

  await fs.writeFile(path.join(root, 'dup.ts'), 'x();\nx();\n');
  await executeTool(ctx, 'read_file', { path: 'dup.ts' });
  await assert.rejects(executeTool(ctx, 'edit_file', { path: 'dup.ts', old_string: 'x();', new_string: 'y();' }), /aparece 2 vezes/);
  await executeTool(ctx, 'edit_file', { path: 'dup.ts', old_string: 'x();', new_string: 'y();', replace_all: true });
  assert.equal(await fs.readFile(path.join(root, 'dup.ts'), 'utf-8'), 'y();\ny();\n');
});

test('edit_file - preserva CRLF e detecta arquivo alterado por fora', async () => {
  const root = await makeProject();
  const ctx = await makeCtx(root);
  await executeTool(ctx, 'read_file', { path: 'src/crlf.ts' });
  await executeTool(ctx, 'edit_file', { path: 'src/crlf.ts', old_string: 'const b = 2;', new_string: 'const b = 3;' });
  assert.equal(await fs.readFile(path.join(root, 'src/crlf.ts'), 'utf-8'), 'const a = 1;\r\nconst b = 3;\r\n');

  await new Promise(r => setTimeout(r, 20));
  await fs.writeFile(path.join(root, 'src/crlf.ts'), 'mudado pelo usuário\n');
  await assert.rejects(
    executeTool(ctx, 'edit_file', { path: 'src/crlf.ts', old_string: 'mudado', new_string: 'x' }),
    /mudou desde a última leitura/
  );
});

test('write_file - cria arquivos novos, mas exige leitura para sobrescrever', async () => {
  const root = await makeProject();
  const ctx = await makeCtx(root);
  const created = await executeTool(ctx, 'write_file', { path: 'src/new/util.ts', content: 'export const x = 1;\n' });
  assert.equal(created.change.before, null);
  await assert.rejects(executeTool(ctx, 'write_file', { path: 'src/math.ts', content: '' }), /Leia src\/math\.ts/);
});

test('Ferramentas não escapam da raiz nem entram no .git', async () => {
  const ctx = await makeCtx(await makeProject());
  await assert.rejects(executeTool(ctx, 'read_file', { path: '../../etc/passwd' }), /Acesso negado/);
  await assert.rejects(executeTool(ctx, 'write_file', { path: '.git/config', content: 'x' }), /\.git/);
  await assert.rejects(executeTool(ctx, 'list_dir', { path: '..' }), /Acesso negado|não encontrado/);
  await assert.rejects(executeTool(ctx, 'nope', {}), ToolError);
});

test('Diff - mostra só as linhas alteradas com contexto', () => {
  const before = Array.from({ length: 50 }, (_, i) => `l${i}`).join('\n');
  const after = before.replace('l25', 'L25!');
  const diff = diffLines(before, after);
  assert.deepEqual(countChanges(diff), { added: 1, removed: 1 });
  assert.ok(diff.length <= 9, 'hunk com 3 linhas de contexto de cada lado');
  assert.equal(diff[0].type, '@');
});

test('Tool calls em texto (fallback para modelos sem suporte nativo)', () => {
  const a = parseTextToolCalls('Vou ler.\n<tool_call>{"name":"read_file","arguments":{"path":"a.ts"}}</tool_call>');
  assert.equal(a.calls[0].function.name, 'read_file');
  assert.equal(a.calls[0].function.arguments.path, 'a.ts');
  assert.equal(a.rest, 'Vou ler.');

  const b = parseTextToolCalls('```json\n{"name":"grep","arguments":"{\\"pattern\\":\\"x\\"}"}\n```');
  assert.equal(b.calls[0].function.arguments.pattern, 'x');

  assert.equal(parseTextToolCalls('{"name":"rm_rf","arguments":{}}').calls.length, 0, 'ignora ferramentas inexistentes');
  assert.equal(parseTextToolCalls('Resposta normal sem ferramentas.').calls.length, 0);
});

test('Desfazer - restaura arquivos editados e apaga os criados, em ordem inversa', async () => {
  const root = await makeProject();
  const project = await projectService.createProject('teste', root);
  const session = await agentStore.create(project.id, 'qwen3');
  const ctx = await makeCtx(root);

  await executeTool(ctx, 'read_file', { path: 'src/math.ts' });
  const step1 = await executeTool(ctx, 'edit_file', { path: 'src/math.ts', old_string: 'a + b', new_string: 'a * b' });
  await agentStore.addCheckpoint(session.id, { stepId: 's1', path: step1.change.path, content: step1.change.before, timestamp: 1 });
  const step2 = await executeTool(ctx, 'edit_file', { path: 'src/math.ts', old_string: 'a * b', new_string: 'a ** b' });
  await agentStore.addCheckpoint(session.id, { stepId: 's2', path: step2.change.path, content: step2.change.before, timestamp: 2 });
  const step3 = await executeTool(ctx, 'write_file', { path: 'src/extra.ts', content: 'x' });
  await agentStore.addCheckpoint(session.id, { stepId: 's3', path: step3.change.path, content: step3.change.before, timestamp: 3 });

  const partial = await agentService.revert(session.id, 's2');
  assert.deepEqual(partial.files.sort(), ['src/extra.ts', 'src/math.ts']);
  assert.match(await fs.readFile(path.join(root, 'src/math.ts'), 'utf-8'), /a \* b/);
  await assert.rejects(fs.access(path.join(root, 'src/extra.ts')));

  await agentService.revert(session.id, 's1');
  assert.match(await fs.readFile(path.join(root, 'src/math.ts'), 'utf-8'), /return a \+ b;/);
  await assert.rejects(agentService.revert(session.id, 's1'), /Checkpoint não encontrado/);

  const saved = await agentStore.get(session.id);
  assert.equal(saved.timeline.filter(t => t.kind === 'revert').length, 2);
});

const { formatKnowledgeHits } = await import('../dist/services/agent/tools.js');

test('run_command - pede aprovação, executa e devolve exit code e saída', async () => {
  const ctx = await makeCtx(await makeProject());
  const asked = [];
  ctx.requestApproval = async (command, cwd) => {
    asked.push({ command, cwd });
    return 'approved';
  };
  const ok = await executeTool(ctx, 'run_command', { command: 'node -e "console.log(40 + 2)"' });
  assert.deepEqual(asked, [{ command: 'node -e "console.log(40 + 2)"', cwd: '.' }]);
  assert.match(ok.output, /exit code 0/);
  assert.match(ok.output, /42/);
  assert.equal(ok.commandFailed, false);

  const fail = await executeTool(ctx, 'run_command', { command: 'node -e "process.exit(3)"', cwd: 'src' });
  assert.match(fail.output, /exit code 3/);
  assert.equal(fail.commandFailed, true);
  assert.equal(asked[1].cwd, 'src');
});

test('run_command - recusa, desabilitado e cwd fora do projeto', async () => {
  const ctx = await makeCtx(await makeProject());
  await assert.rejects(executeTool(ctx, 'run_command', { command: 'echo oi' }), /desabilitada/);

  ctx.requestApproval = async () => 'denied';
  await assert.rejects(executeTool(ctx, 'run_command', { command: 'echo oi' }), /recusou/);

  ctx.requestApproval = async () => 'approved';
  await assert.rejects(executeTool(ctx, 'run_command', { command: 'echo oi', cwd: '..' }), /Acesso negado|não encontrado/);
});

test('run_command - cancelar mata o processo', async () => {
  const ctx = await makeCtx(await makeProject());
  const controller = new AbortController();
  ctx.signal = controller.signal;
  ctx.requestApproval = async () => 'approved';
  setTimeout(() => controller.abort(), 300);
  const started = Date.now();
  const result = await executeTool(ctx, 'run_command', { command: 'node -e "setTimeout(() => {}, 20000)"' });
  assert.match(result.output, /cancelado/);
  assert.ok(Date.now() - started < 8000, 'não esperou o processo de 20s');
});

test('search_knowledge - formata fontes e usa o hook de busca', async () => {
  const text = formatKnowledgeHits(
    [{ sourceTitle: 'Windows Internals', pageNumber: 212, chapter: 'IRQL', score: 0.81, text: 'DISPATCH_LEVEL blocks paging.' }],
    ['Kernel & Drivers']
  );
  assert.match(text, /Windows Internals \(p\.212, "IRQL"\) · 81%/);
  assert.match(text, /Coleções consultadas: Kernel & Drivers/);
  assert.match(formatKnowledgeHits([], ['Kernel']), /Nada relevante/);

  const ctx = await makeCtx(await makeProject());
  await assert.rejects(executeTool(ctx, 'search_knowledge', { query: 'irql' }), /Não há base/);
  ctx.searchKnowledge = async (query, collection) => ({
    hits: [{ sourceTitle: 'Livro', score: 0.5, text: `achei ${query} em ${collection}` }],
    collections: [collection],
  });
  const out = await executeTool(ctx, 'search_knowledge', { query: 'spin lock', collection: 'Kernel' });
  assert.match(out.output, /achei spin lock em Kernel/);
  assert.match(out.summary, /1 trecho/);
});
