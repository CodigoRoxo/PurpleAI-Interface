import test from 'node:test';
import assert from 'node:assert/strict';
import { Bm25Index, tokenize } from '../dist/services/lexical.service.js';
import { hybridRetrieve, NO_COLLECTION } from '../dist/services/retrieval.service.js';

// Embeddings sintéticos em 3 eixos: kernel, direito, python
const KERNEL = [1, 0, 0];
const LAW = [0, 1, 0];
const PYTHON = [0, 0, 1];

function jitter(base, i) {
  return base.map((v, idx) => v + 0.05 * ((i + idx) % 3));
}

function makeChunks() {
  const chunks = [];
  const add = (collectionId, base, texts) => texts.forEach((text, i) => chunks.push({
    id: `${collectionId}-${i}`,
    sourceId: `src-${collectionId}`,
    sourceTitle: `Livro ${collectionId}`,
    sourceType: 'pdf',
    collectionId,
    chunkIndex: i,
    text,
    embedding: jitter(base, i),
  }));

  add('kernel', KERNEL, [
    'Drivers em kernel mode tratam IRPs na rotina de dispatch.',
    'O IRQL determina quais interrupções podem preemptar o código do driver.',
    'Spin locks protegem dados compartilhados em IRQL elevado.',
  ]);
  add('law', LAW, [
    'O contrato de locação exige garantia e prazo determinado.',
    'A responsabilidade civil decorre de ato ilícito e dano comprovado.',
    'O prazo prescricional começa a contar da ciência do dano.',
  ]);
  add('python', PYTHON, [
    'List comprehensions criam listas de forma concisa em Python.',
    'O GIL impede que threads executem bytecode Python em paralelo.',
    'Decorators envolvem funções para adicionar comportamento.',
  ]);
  return chunks;
}

function run(query, queryEmbedding, extra = {}) {
  const candidates = extra.candidates || makeChunks();
  const lexicalIndex = new Bm25Index(candidates.map(c => ({ id: c.id, text: c.text })));
  return hybridRetrieve({
    query,
    queryEmbedding,
    candidates,
    lexicalIndex,
    collectionOf: c => c.collectionId,
    describeCollection: id => ({ name: id ?? 'Sem coleção' }),
    topK: 4,
    minScore: 0.2,
    ...extra,
  });
}

test('Tokenize - remove acentos e stopwords, separa snake_case e camelCase', () => {
  const tokens = tokenize('Como funciona o IRP_MJ_CREATE no KeAcquireSpinLock? Ação');
  assert.ok(tokens.includes('irp_mj_create'));
  assert.ok(tokens.includes('create'));
  assert.ok(tokens.includes('keacquirespinlock'));
  assert.ok(tokens.includes('spin'));
  assert.ok(tokens.includes('acao'));
  assert.ok(!tokens.includes('como'));
  assert.ok(!tokens.includes('funciona'));
});

test('BM25 - termo raro pesa mais que termo comum', () => {
  const index = new Bm25Index([
    { id: 'a', text: 'driver driver driver kernel' },
    { id: 'b', text: 'driver KeAcquireSpinLock' },
    { id: 'c', text: 'driver python' },
  ]);
  const scores = index.search('KeAcquireSpinLock driver');
  const best = [...scores.entries()].sort((x, y) => y[1] - x[1])[0][0];
  assert.equal(best, 'b');
});

test('Roteamento - pergunta de kernel consulta só a coleção de kernel', () => {
  const { results, route } = run('como o IRQL afeta meu driver?', [0.95, 0.1, 0.05]);
  assert.equal(route.mode, 'auto');
  assert.deepEqual(route.selected.map(c => c.id), ['kernel']);
  assert.ok(results.length > 0);
  assert.ok(results.every(r => r.collectionId === 'kernel'), 'nenhum trecho de direito ou python');
});

test('Roteamento - pergunta de direito não puxa livros de kernel', () => {
  const { results, route } = run('qual o prazo prescricional do dano?', [0.05, 0.97, 0.1]);
  assert.deepEqual(route.selected.map(c => c.id), ['law']);
  assert.ok(results.every(r => r.collectionId === 'law'));
});

test('Roteamento - pergunta ambígua pode consultar duas coleções', () => {
  const { route } = run('threads e locks', [0.7, 0, 0.7]);
  const ids = route.selected.map(c => c.id).sort();
  assert.deepEqual(ids, ['kernel', 'python']);
});

test('Manual - coleção fixada pelo usuário ignora a votação', () => {
  const { results, route } = run('como o IRQL afeta meu driver?', [0.95, 0.1, 0.05], { manualCollectionIds: ['python'] });
  assert.equal(route.mode, 'manual');
  assert.deepEqual(route.selected.map(c => c.id), ['python']);
  assert.ok(results.every(r => r.collectionId === 'python'));
});

test('Híbrido - identificador exato é encontrado mesmo com embedding fraco', () => {
  const candidates = makeChunks();
  candidates.push({
    id: 'kernel-exact',
    sourceId: 'src-kernel',
    sourceTitle: 'Livro kernel',
    sourceType: 'pdf',
    collectionId: 'kernel',
    chunkIndex: 9,
    text: 'IRP_MJ_DEVICE_CONTROL é tratado por DispatchDeviceControl.',
    embedding: [0.3, 0.25, 0.25],
  });
  const { results } = run('IRP_MJ_DEVICE_CONTROL', [0.9, 0.2, 0.1], { candidates });
  assert.ok(results.some(r => r.id === 'kernel-exact'), 'o BM25 traz o trecho com o identificador');
  const hit = results.find(r => r.id === 'kernel-exact');
  assert.ok(hit.lexicalScore > 0);
});

test('Fontes sem coleção formam um grupo próprio', () => {
  const candidates = makeChunks().map(c => c.collectionId === 'python' ? { ...c, collectionId: undefined } : c);
  const { route } = run('decorators em python', [0.05, 0.05, 0.98], { candidates });
  assert.deepEqual(route.selected.map(c => c.id), [null]);
  assert.equal(route.selected[0].name, 'Sem coleção');

  const manual = run('decorators em python', [0.05, 0.05, 0.98], { candidates, manualCollectionIds: [NO_COLLECTION] });
  assert.ok(manual.results.every(r => r.collectionId === undefined));
});

test('Nada relevante - não injeta trechos aleatórios', () => {
  const { results } = run('receita de bolo de cenoura', [-1, -1, -1]);
  assert.equal(results.length, 0);
});
