# PurpleAI Interface: contexto do projeto

Documento para quem chega agora, humano ou IA. Explica o que o projeto faz, para onde vai e o que precisa ser respeitado ao mexer nele. O README é a vitrine para usuários; este arquivo é o contexto de trabalho.

Última revisão: 2026-11-03, no commit `c2adfc1`.

## O que é

Uma interface web que roda na máquina do usuário e transforma modelos locais do Ollama em um assistente e agente de trabalho: sem assinatura e sem enviar dados para a nuvem. Tem três modos:

- **Chat:** conversa com o modelo local, com streaming e monitor de uso de contexto.
- **Base de conhecimento (RAG):** o usuário indexa PDFs, livros e código em coleções, e o modelo responde com base neles, citando as fontes.
- **Agente:** o modelo trabalha sozinho em um projeto cadastrado: explora, lê, edita vários arquivos, compila e corrige, com diff e desfazer.

## Objetivo

Uma base para que qualquer pessoa, em qualquer nicho, tenha um auxiliar local usando o próprio hardware e os próprios dados. A ambição declarada é um repositório digno de 10k stars.

A referência de experiência para o Agente é o **Antigravity**: anexar um projeto, deixar o agente mexer nele como um todo e ele continuar sabendo o objetivo mesmo depois de limpar o contexto. O autor também trabalha com programação de baixo nível (kernel, drivers), então revisar e completar esse tipo de projeto é um caso de uso real.

Posicionamento pretendido: um agente de código local que rende bem em GPU doméstica. Os limites de um modelo de 14B são compensados pela estrutura: ferramentas, contexto certeiro, memória externa e feedback do compilador.

## Stack e como rodar

Monorepo com npm workspaces, em TypeScript. Sem banco de dados: tudo é JSON em disco, em `backend/data/` (ignorado pelo git).

- **Backend:** Node + Express, porta 3001.
- **Frontend:** React 18 + Vite + Tailwind, porta 3000, com proxy de `/api` para o backend.
- **Modelos:** Ollama em `localhost:11434`. Embedding padrão: `bge-m3`.

```bash
npm install
npm run dev
```

O backend não serve o frontend: em desenvolvimento, os dois sobem juntos. Configuração em `backend/.env` (veja `backend/.env.example`).

## Mapa do código

```
backend/src/
  server.ts                  Express: CORS, guard de segurança, rotas
  config/env.ts              Todas as variáveis de ambiente
  middleware/security.ts     Allowlist de Origin e Host, token opcional
  utils/paths.ts             Confinamento de caminhos na raiz do projeto
  utils/diff.ts              Diff de linhas para a timeline
  controllers/ routes/       Camada HTTP de cada área
  services/
    ollama.service.ts        Chat, embeddings em lote, capacidades do modelo
    chunker.service.ts       Divide texto, Markdown, PDF e código em trechos
    vector.service.ts        Vetores da base de conhecimento (vectors.json)
    lexical.service.ts       Índice BM25 em memória
    retrieval.service.ts     Busca híbrida e roteamento por coleção
    knowledge.service.ts     Fontes: upload, indexação, reindexação
    collection.service.ts    Coleções
    project.service.ts       Projetos: indexação, árvore, patches, reindexFile
    storage.service.ts       Conversas do chat
    rag_debug.service.ts     Diagnóstico do pipeline RAG
    agent/
      agent.service.ts       Loop do agente, aprovações, desfazer
      tools.ts               Definição e execução das ferramentas
      workspace.ts           Operações de arquivo confinadas ao projeto
      command-runner.ts      Execução de comandos com timeout e kill
      agent.store.ts         Sessões e checkpoints (data/agent/)

frontend/src/
  App.tsx                    Estado global e troca de telas
  services/api.ts            Todas as chamadas à API
  hooks/                     useChatStream, useKnowledge, useAgent, ...
  components/                chat/ knowledge/ projects/ agent/ layout/
```

## Como funciona

**RAG:** o chat chama `retrievalService.retrieve`. Ele combina similaridade de cosseno com BM25 por Reciprocal Rank Fusion. Os melhores resultados votam nas coleções, e só as que têm evidência forte (no máximo 2) fornecem trechos ao contexto. O usuário pode fixar uma coleção manualmente. Cada trecho guarda o modelo de embedding que o gerou, e vetores de outro modelo ficam fora da busca até reindexar.

**Agente:** a cada mensagem, até 30 passos: o modelo recebe as ferramentas, pede uma, o backend executa e devolve o resultado, até ele responder sem chamar ferramenta. Usa o tool calling nativo do Ollama, com um parser de reserva para modelos que escrevem a chamada como texto. Ferramentas: `list_dir`, `read_file`, `grep`, `glob`, `edit_file`, `write_file`, `run_command` e `search_knowledge`. As duas últimas só são oferecidas quando estão habilitadas ou há fontes ativas.

## O que não pode quebrar

Regras de segurança e confiabilidade. Cada uma existe por um motivo:

- **A API fica em `127.0.0.1` por padrão.** O backend grava arquivos e executa comandos, então fora do loopback ele se recusa a iniciar sem `PURPLEAI_API_TOKEN`. Antes disso, qualquer site aberto no navegador ou dispositivo na rede podia executar comandos na máquina.
- **Todo acesso a arquivo de projeto passa por `resolvePathInRoot`:** não sai da raiz, segue symlinks e bloqueia `.git`.
- **`edit_file` só edita o que foi lido e continua igual no disco,** e o trecho precisa bater exatamente e ser único. É isso que impede um modelo pequeno de editar às cegas.
- **Toda edição do agente gera checkpoint** para o "Desfazer até aqui".
- **`run_command` espera aprovação do usuário,** exceto o comando exato liberado em "Sempre permitir" naquele projeto.
- **O agente nunca carrega drivers ou serviços.** Teste em execução é do usuário, numa VM.
- **Trocar de modelo de embedding nunca mistura vetores.**

## Testes

Os testes importam de `dist/`, então compile antes. Testes sem GPU, que são os que a CI roda:

```bash
npm run build --workspace=backend
```
```bash
cd backend && node --test tests/security.test.mjs tests/retrieval.test.mjs tests/agent.test.mjs tests/agent-loop.test.mjs
```

- O `agent-loop.test.mjs` testa o loop inteiro contra um **Ollama falso**, um servidor HTTP local que responde com chamadas de ferramenta pré-programadas. Use essa técnica para testar sem GPU.
- **Cuidado com `npm test`:** ele inclui o `rag.test.mjs`, que chama o Ollama real e usa o diretório de dados padrão, ou seja, os dados reais do usuário. Os testes 4 a 6 falham se o Ollama estiver desligado.
- Testes novos que usam serviços devem apontar `DATA_DIR`, `KNOWLEDGE_DIR`, `PROJECTS_DIR` e `AGENT_DIR` para uma pasta temporária **antes** de importar os módulos.

## Estado atual

**Pronto e no GitHub:**
- Correção de segurança da API.
- RAG Fase 1: embedding multilíngue, busca híbrida, roteamento por coleção.
- Agente Marco 1: loop, ferramentas, checkpoints, timeline.
- Agente Marco 3: `run_command` com aprovação.
- `search_knowledge`, adiantado do Marco 4.

**Ainda não validado:**
- **O agente nunca rodou com um modelo real,** só com o Ollama falso. Este é o próximo passo. Plano: teste em escada com `qwen3-14b` (pergunta, edição em um arquivo, renomear em vários, corrigir um bug real), ajustando prompt e ferramentas conforme o que aparecer.
- `search_knowledge` e o roteamento nunca rodaram com `bge-m3`, que não estava instalado na última verificação (2026-10-29). O roteamento foi testado com `all-minilm`.

## Próximos passos

Na ordem combinada:

1. Testar o agente com modelo real.
2. **Roteador de modelos pagos** (Claude, GPT, Gemini): uma tela de provedores com chave própria guardada só no backend, modelos no mesmo seletor do Ollama, funcionando no chat e no agente, e um aviso claro de que o código vai para a nuvem. Modelo local para o simples, pago para o difícil.
3. **Marco 2, memória e compactação:** objetivo, `plan.md` e `task.md` por sessão, fora da conversa; resumo do histórico perto de 70% do contexto, reinjetando o plano. É o que faz o agente "continuar sabendo o que você quer" depois da limpeza. Hoje ele só encurta saídas antigas de ferramentas.
4. **RAG Fase 2:** corte de relevância calibrado por modelo, reescrita da pergunta com o histórico, junção de trechos vizinhos, vínculo de coleções a projetos.
5. **Resto do Marco 3 e Marco 4:** mapa do repositório com tree-sitter, `AGENTS.md` por projeto, modos de permissão.
6. **Para o lançamento:** i18n com inglês primeiro, endpoints compatíveis com OpenAI (LM Studio, llama.cpp), instalação em um comando (Docker ou `npx`), GIF de demonstração no README, suporte a MCP.

## Problemas conhecidos

- **Fluxo antigo do chat com projeto:** o `applyFilePatch` tem um fallback "fuzzy" que pode substituir o trecho errado. O `saveProjectFile` ainda cria `.bak` no repositório do usuário. O prompt do chat prefere arquivo completo, e o modelo muitas vezes só viu um trecho, então sobrescrever pode apagar código. O Agente não tem nenhum desses problemas.
- **Cache de prompt:** o chat coloca o contexto do RAG no início das mensagens. Como o início muda a cada pergunta, o Ollama reprocessa tudo. Mover o contexto para perto da última mensagem resolve.
- **Corte de relevância:** com `bge-m3`, trechos sem relação ainda dão uns 30–40% de similaridade, então trechos fracos podem entrar quando nenhuma coleção tem a resposta (veja a Fase 2).
- **Escala:** os vetores ficam em JSON, e os de projeto são lidos do disco a cada busca. Candidato a `sqlite-vec` ou LanceDB.
- **Concorrência:** a gravação ao fim de uma indexação completa de projeto não passa pelo lock de vetores usado em `reindexFile`.
- **Idioma:** a interface e os prompts do chat estão em português fixo. O prompt do agente é em inglês, com instrução para responder no idioma do usuário.
- **Promessas do README:** o trecho "100% local" terá de ser revisto quando o roteador de modelos pagos existir.

## Como trabalhar neste repositório

- **Commits:** só em nome do autor (Codigo Roxo), **sem** linha `Co-Authored-By`. O projeto tem um autor só, então o fluxo é direto na `main`: branch curta se ajudar, depois `merge --ff-only` e push.
- **GPU:** o autor renderiza vídeo na mesma máquina. **Pergunte antes** de rodar qualquer coisa que use o Ollama real (chat, embeddings, `ollama pull`). Na dúvida, use o Ollama falso.
- **`gh`:** o GitHub CLI não estava instalado na última verificação.
- **Idioma:** o autor conversa em português. Comentários e mensagens de interface também são em português; mensagens de commit e prompts do agente, em inglês.
- **Estilo:** siga o código ao redor. Serviços são classes exportadas como singleton, e toda chamada à API do frontend fica em `services/api.ts`.
- **Modelos instalados na última verificação (2026-10-29):** `qwen3-14b`, `qwen2.5vl:7b`, `llama3.2:3b`, `purple-ai`, `purple-lowlevel-verb`, `purple-7b-uncensored` e `all-minilm`. Os modelos `purple-*` são personalizados do autor; confira se aceitam ferramentas.
