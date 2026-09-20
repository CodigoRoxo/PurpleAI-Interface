import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkerService } from '../dist/services/chunker.service.js';
import { vectorService } from '../dist/services/vector.service.js';
import { ragDebugService } from '../dist/services/rag_debug.service.js';

test('1. ChunkerService - Chunking de Markdown com metadados e capítulos', () => {
  const md = `# Capítulo 1: Paginação no x64
A arquitetura x86-64 utiliza paginação de 4 níveis: PML4, PDPT, PD e PT.

## CR3 e Estrutura de Tradução
O registrador CR3 armazena o endereço físico base do PML4.
Cada tabela possui 512 entradas de 8 bytes cada.`;

  const chunks = chunkerService.chunkMarkdown(md, 'docs/memory.md');
  assert.ok(chunks.length >= 2, 'Deve gerar pelo menos 2 chunks para as seções de cabeçalho');
  assert.equal(chunks[0].language, 'markdown');
  assert.equal(chunks[0].chapter, 'Capítulo 1: Paginação no x64');
  assert.equal(chunks[1].chapter, 'CR3 e Estrutura de Tradução');
  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(chunks[1].chunkIndex, 1);
});

test('2. ChunkerService - Chunking de Código-Fonte com detecção de linguagem e linhas', () => {
  const codeLines = [];
  for (let i = 1; i <= 80; i++) {
    codeLines.push(`NTSTATUS DispatchRoutine${i}(PDEVICE_OBJECT DeviceObject, PIRP Irp) { return STATUS_SUCCESS; }`);
  }
  const codeContent = codeLines.join('\n');

  const chunks = chunkerService.chunkCode(codeContent, 'src/driver.cpp');
  assert.ok(chunks.length >= 2, 'Código longo deve ser dividido em chunks');
  assert.equal(chunks[0].language, 'cpp');
  assert.equal(chunks[0].startLine, 1);
  assert.ok((chunks[0].endLine || 0) >= 50);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(chunks[1].chunkIndex, 1);
});

test('3. VectorService - Similaridade de Cosseno', () => {
  const vecA = [1, 0, 0];
  const vecB = [1, 0, 0];
  const vecC = [0, 1, 0];
  const vecD = [-1, 0, 0];

  const simIdentical = vectorService.cosineSimilarity(vecA, vecB);
  const simOrthogonal = vectorService.cosineSimilarity(vecA, vecC);
  const simOpposite = vectorService.cosineSimilarity(vecA, vecD);

  assert.ok(Math.abs(simIdentical - 1.0) < 0.0001, 'Vetores idênticos devem ter score 1.0');
  assert.ok(Math.abs(simOrthogonal - 0.0) < 0.0001, 'Vetores ortogonais devem ter score 0.0');
  assert.ok(Math.abs(simOpposite - (-1.0)) < 0.0001, 'Vetores opostos devem ter score -1.0');
});

test('4. RAG Hardening - Proteção contra Prompt Injection no Template de Contexto', async () => {
  const trace = await ragDebugService.inspectPipeline('Como funciona o driver?', 'qwen-lowlevel:latest', 1, 0.20);
  
  // O prompt montado deve conter as diretrizes estritas e tags de delimitação
  assert.ok(trace.prompt.systemDirective.includes('<contexto_recuperado>'), 'Deve conter tag delimitadora de abertura');
  assert.ok(trace.prompt.systemDirective.includes('</contexto_recuperado>'), 'Deve conter tag delimitadora de fechamento');
  assert.ok(trace.prompt.systemDirective.includes('DADOS DE REFERÊNCIA NÃO CONFIÁVEIS'), 'Deve instruir o LLM a tratar documentos como não confiáveis');
  assert.ok(trace.prompt.systemDirective.includes('NUNCA invente citações'), 'Deve proibir alucinação de fontes');
});

test('5. Teste de Sanidade Obrigatório - Ingestão e Recuperação de VIOLET-7429', { timeout: 30000 }, async () => {
  const result = await ragDebugService.runSanityTest();
  console.log('Sanity Test Result:', result.details);
  assert.ok(result.passed, `O teste de sanidade deve passar. Detalhes: ${result.details}`);
  assert.ok(result.secretFound, 'A resposta deve conter o código secreto VIOLET-7429');
});

test('6. Teste Negativo - Distinção de Informação Inexistente VIOLET-9999', { timeout: 30000 }, async () => {
  const result = await ragDebugService.runNegativeTest();
  console.log('Negative Test Result:', result.details);
  assert.ok(result.passed, `O teste negativo deve passar sem alucinação. Detalhes: ${result.details}`);
  assert.equal(result.hallucinated, false, 'O modelo não deve alucinar a existência de VIOLET-9999');
});
