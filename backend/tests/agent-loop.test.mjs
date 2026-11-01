import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/**
 * Loop do agente contra um "Ollama falso" que responde com tool calls roteirizadas.
 * Testa o fluxo completo (stream, ferramentas, checkpoints, timeline) sem usar GPU.
 */
const script = [];
const requests = [];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    if (req.url === '/api/show') {
      res.end(JSON.stringify({ capabilities: ['completion', 'tools'] }));
      return;
    }
    if (req.url === '/api/chat') {
      requests.push(JSON.parse(body));
      const reply = script.shift() || [{ message: { content: 'Fim.' }, done: true }];
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      for (const chunk of reply) res.write(JSON.stringify(chunk) + '\n');
      res.end();
      return;
    }
    res.writeHead(404);
    res.end('{"error":"not found"}');
  });
});
await new Promise(r => fake.listen(0, '127.0.0.1', r));

const base = await fs.mkdtemp(path.join(os.tmpdir(), 'purpleai-loop-'));
process.env.AGENT_DIR = path.join(base, 'agent');
process.env.PROJECTS_DIR = path.join(base, 'projects');
process.env.KNOWLEDGE_DIR = path.join(base, 'knowledge');
process.env.DATA_DIR = path.join(base, 'conversations');
process.env.OLLAMA_HOST = `http://127.0.0.1:${fake.address().port}`;

const { agentService } = await import('../dist/services/agent/agent.service.js');
const { agentStore } = await import('../dist/services/agent/agent.store.js');
const { projectService } = await import('../dist/services/project.service.js');

test.after(async () => {
  fake.close();
  await fs.rm(base, { recursive: true, force: true });
});

const call = (name, args) => ({ function: { name, arguments: args } });

test('Loop - lê, edita dois arquivos, resume e registra checkpoints', async () => {
  const root = path.join(base, 'app');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'math.ts'), 'export function sum(a: number, b: number) {\n  return a + b;\n}\n');
  await fs.writeFile(path.join(root, 'src', 'app.ts'), "import { sum } from './math';\nconsole.log(sum(1, 2));\n");
  const project = await projectService.createProject('app', root);
  const session = await agentStore.create(project.id, 'fake');

  script.push(
    [{ message: { content: '', tool_calls: [call('grep', { pattern: 'sum' })] }, done: true }],
    [{ message: { content: '', tool_calls: [call('read_file', { path: 'src/math.ts' }), call('read_file', { path: 'src/app.ts' })] }, done: true }],
    [{ message: { content: '', tool_calls: [
      call('edit_file', { path: 'src/math.ts', old_string: 'export function sum', new_string: 'export function add' }),
      call('edit_file', { path: 'src/app.ts', old_string: "import { sum } from './math';\nconsole.log(sum(1, 2));", new_string: "import { add } from './math';\nconsole.log(add(1, 2));" }),
    ] }, done: true }],
    [{ message: { content: 'Renomeei ' } }, { message: { content: '`sum` para `add` nos 2 arquivos.' }, done: true }],
  );

  const events = [];
  await agentService.run({ sessionId: session.id, message: 'renomeie sum para add', model: 'fake' }, e => events.push(e));

  assert.match(await fs.readFile(path.join(root, 'src/math.ts'), 'utf-8'), /export function add/);
  assert.match(await fs.readFile(path.join(root, 'src/app.ts'), 'utf-8'), /console\.log\(add\(1, 2\)\)/);

  const done = events.find(e => e.type === 'done');
  assert.equal(done.status, 'completed');

  const saved = await agentStore.get(session.id);
  const tools = saved.timeline.filter(t => t.kind === 'tool');
  assert.deepEqual(tools.map(t => t.name), ['grep', 'read_file', 'read_file', 'edit_file', 'edit_file']);
  assert.ok(tools.every(t => t.status === 'ok'));
  assert.ok(tools.filter(t => t.checkpoint).every(t => t.diff.length > 0));
  assert.equal(saved.title, 'renomeie sum para add');
  const answer = saved.timeline.find(t => t.kind === 'assistant');
  assert.equal(answer.text, 'Renomeei `sum` para `add` nos 2 arquivos.');
  assert.equal((await agentStore.getCheckpoints(session.id)).length, 2);

  // O modelo recebeu as ferramentas e o resultado de cada uma no histórico
  assert.deepEqual(requests[0].tools.map(t => t.function.name).slice(-1), ['run_command'], 'sem base ativa, search_knowledge não é oferecida');
  const lastRequest = requests.at(-1);
  assert.ok(lastRequest.messages.some(m => m.role === 'tool' && m.tool_name === 'edit_file'));
  assert.match(lastRequest.messages[0].content, /src\//, 'o prompt de sistema inclui a árvore do projeto');
});

test('Loop - erro de ferramenta volta para o modelo, que corrige a chamada', async () => {
  const root = path.join(base, 'app2');
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'a.txt'), 'olá\n');
  const project = await projectService.createProject('app2', root);
  const session = await agentStore.create(project.id, 'fake');

  script.push(
    [{ message: { content: '', tool_calls: [call('edit_file', { path: 'a.txt', old_string: 'olá', new_string: 'oi' })] }, done: true }],
    [{ message: { content: '', tool_calls: [call('read_file', { path: 'a.txt' })] }, done: true }],
    // Modelo sem tool calling nativo escrevendo a chamada como texto
    [{ message: { content: '<tool_call>{"name":"edit_file","arguments":{"path":"a.txt","old_string":"olá","new_string":"oi"}}</tool_call>' }, done: true }],
    [{ message: { content: 'Feito.' }, done: true }],
  );

  await agentService.run({ sessionId: session.id, message: 'troque olá por oi', model: 'fake' }, () => {});
  assert.equal(await fs.readFile(path.join(root, 'a.txt'), 'utf-8'), 'oi\n');

  const saved = await agentStore.get(session.id);
  const tools = saved.timeline.filter(t => t.kind === 'tool');
  assert.equal(tools[0].status, 'error');
  assert.match(tools[0].summary, /Leia a\.txt/);
  assert.equal(tools.at(-1).status, 'ok');
  const toolMsg = saved.messages.find(m => m.role === 'tool');
  assert.match(toolMsg.content, /^ERROR:/);
});

test('Loop - recusa modelo sem suporte a ferramentas', async () => {
  const root = path.join(base, 'app3');
  await fs.mkdir(root, { recursive: true });
  const project = await projectService.createProject('app3', root);
  const session = await agentStore.create(project.id, 'fake');

  const original = fake.listeners('request')[0];
  fake.removeAllListeners('request');
  fake.on('request', (req, res) => {
    if (req.url === '/api/show') {
      res.end(JSON.stringify({ capabilities: ['completion'] }));
    } else {
      original(req, res);
    }
  });

  const events = [];
  await agentService.run({ sessionId: session.id, message: 'oi', model: 'sem-tools' }, e => events.push(e));
  fake.removeAllListeners('request');
  fake.on('request', original);

  const done = events.find(e => e.type === 'done');
  assert.equal(done.status, 'error');
  assert.match(done.message, /não suporta ferramentas/);
});

test('Loop - comando espera aprovação; "sempre permitir" libera as próximas vezes', async () => {
  const root = path.join(base, 'app4');
  await fs.mkdir(root, { recursive: true });
  const project = await projectService.createProject('app4', root);
  const command = 'node -e "console.log(123)"';

  const runOnce = async (respond) => {
    const session = await agentStore.create(project.id, 'fake');
    script.push(
      [{ message: { content: '', tool_calls: [call('run_command', { command })] }, done: true }],
      [{ message: { content: 'Build ok.' }, done: true }],
    );
    let askedApproval = false;
    await agentService.run({ sessionId: session.id, message: 'compile', model: 'fake' }, e => {
      if (e.type === 'timeline' && e.item.kind === 'tool' && e.item.status === 'awaiting') {
        askedApproval = true;
        setTimeout(() => respond(session.id, e.item.id), 10);
      }
    });
    return { session: await agentStore.get(session.id), askedApproval };
  };

  // 1ª vez: o usuário recusa
  const denied = await runOnce((sid, step) => agentService.resolveApproval(sid, step, false));
  const deniedTool = denied.session.timeline.find(t => t.kind === 'tool');
  assert.equal(deniedTool.approval, 'denied');
  assert.equal(deniedTool.status, 'error');
  assert.ok(denied.askedApproval);

  // 2ª vez: aprova com "sempre permitir"
  const approved = await runOnce((sid, step) => agentService.resolveApproval(sid, step, true, true));
  const approvedTool = approved.session.timeline.find(t => t.kind === 'tool');
  assert.equal(approvedTool.approval, 'approved');
  assert.match(approvedTool.output, /123/);
  assert.deepEqual((await projectService.getProject(project.id)).settings.allowedCommands, [command]);

  // 3ª vez: roda direto, sem pedir
  const auto = await runOnce(() => assert.fail('não deveria pedir aprovação'));
  const autoTool = auto.session.timeline.find(t => t.kind === 'tool');
  assert.equal(autoTool.approval, 'auto_approved');
  assert.equal(autoTool.status, 'ok');
});

test('Loop - parar enquanto espera aprovação encerra sem executar', async () => {
  const root = path.join(base, 'app5');
  await fs.mkdir(root, { recursive: true });
  const project = await projectService.createProject('app5', root);
  const session = await agentStore.create(project.id, 'fake');
  script.push([{ message: { content: '', tool_calls: [call('run_command', { command: 'node -e "require(\'fs\').writeFileSync(\'ran.txt\', \'x\')"' })] }, done: true }]);

  const events = [];
  await agentService.run({ sessionId: session.id, message: 'rode', model: 'fake' }, e => {
    events.push(e);
    if (e.type === 'timeline' && e.item.kind === 'tool' && e.item.status === 'awaiting') {
      setTimeout(() => agentService.stop(session.id), 10);
    }
  });
  assert.equal(events.find(e => e.type === 'done').status, 'aborted');
  await assert.rejects(fs.access(path.join(root, 'ran.txt')), 'o comando não rodou');
  script.length = 0;
});
