<div align="center">

# 🟣 PurpleAI Interface `v2.0`

### Seu Copilot & Workspace de IA 100% Local, Privado e sem Custos de Nuvem
**Transforme qualquer modelo local do Ollama (DeepSeek, Qwen Coder, Llama) em uma estação de trabalho inteligente com RAG Vetorial e Modificação de Código em Disco.**

🌐 **[ENGLISH VERSION AVAILABLE HERE](README.en.md)** • 🇧🇷 **[Versão em Português](README.md)**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-emerald.svg)](https://nodejs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Local_Engine-black?logo=ollama)](https://ollama.com/)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

[🎯 O Intuito](#-o-intuito-do-projeto) • [✨ Pilares](#-os-4-pilares-do-purpleai) • [📸 Screenshots](#-screenshots) • [⚡ Recursos](#-recursos-completos) • [🚀 Quick Start](#-quick-start-como-rodar) • [🏗️ Arquitetura](#-arquitetura-do-sistema)

---

</div>

## 🎯 O Intuito do Projeto

A grande maioria das ferramentas de IA para desenvolvedores hoje (como GitHub Copilot, Cursor ou ChatGPT) sofre de dois problemas fundamentais:

1. **Dependência de Nuvem e Privacidade Comprometida**: O código da sua empresa, seus segredos e seus documentos técnicos são enviados para servidores de terceiros.
2. **UIs Locais Limitadas a "Apenas Chat"**: A maioria das interfaces web para Ollama atua somente como um chat genérico isolado. Elas não conseguem ler repositórios inteiros, não possuem noção da árvore de arquivos do seu projeto e não conseguem aplicar modificações de verdade no seu disco.

> 💡 **O PurpleAI Interface nasceu para preencher essa lacuna:**  
> Oferecer uma interface de desenvolvimento moderna, rápida e esteticamente refinada que roda **100% no seu hardware**, permitindo que você converse com modelos locais de ponta, consulte documentações técnicas via RAG e **permita que a IA proponha e aplique correções de código diretamente no seu disco com 1 clique e segurança total (backup automático)**.

---

## ✨ Os 4 Pilares do PurpleAI

| Pilar | Descrição |
| :--- | :--- |
| 💻 **Workspace & Code Agent** | Conecte pastas de projetos locais no seu computador. A IA navega na árvore de arquivos, compreende o contexto do repositório, sugere alterações cirúrgicas (`SEARCH/REPLACE diff`) ou arquivos completos e aplica no disco com 1 clique (com backup `.bak` automático e terminal de comandos embutido). |
| 🧠 **Base de Conhecimento Vetorial (RAG)** | Faça ingestão de documentações técnicas, PDFs, livros e notas em Markdown. O motor vetorial local fatia o conteúdo em chunks inteligentes e recupera fragmentos exatos por similaridade de cosseno, fundamentando as respostas do modelo com citações reais e zero alucinação. |
| 📊 **Monitor HUD de Contexto em Tempo Real** | Telemetria ao vivo dos tokens do Ollama (`num_ctx` de 16k tokens) exibida em uma barra de progresso cyberpunk no rodapé. Acompanhe o consumo exato de Prompt, RAG e Resposta com gradientes dinâmicos (roxo, âmbar e vermelho pulsante) e poda inteligente de memória para evitar erros de estouro de contexto. |
| 🪟 **Layout Widescreen & Modo Foco** | Interface generosa (`max-w-[1550px]`) projetada para telas Full HD e Ultrawide. Blocos de código ocupam a largura total sem quebras artificiais de linha, e a barra lateral pode ser recolhida a qualquer momento no topo para uma experiência imersiva de leitura e edição. |

---

## 📸 Screenshots

<div align="center">

### 💬 Chat com Streaming & HUD de Contexto ao Vivo
*Streaming token a token, seletor dinâmico de modelos do Ollama e monitor de consumo da janela de contexto no rodapé:*

![Chat Interface](docs/screenshots/chat.png)

---

### 🛠️ Workspace de Projetos & Aplicação de Alterações no Disco
*Árvore de arquivos, syntax highlighting e card interativo para aplicar diffs ou arquivos completos com 1 clique:*

![Projects Workspace](docs/screenshots/projects.png)

---

### 🧠 Base de Conhecimento & RAG Vetorial
*Upload de documentos técnicos, segmentação de texto (chunks) e busca semântica ultrarrápida:*

![Knowledge Base](docs/screenshots/knowledge.png)

</div>

---

## ⚡ Recursos Completos

- 🔒 **100% Local & Privado**: Zero telemetria, zero requisições para servidores externos. Tudo roda no seu computador.
- ⚡ **Detecção Automática do Ollama**: Verifica o status da API e sincroniza automaticamente a lista de modelos instalados (`llama3.2`, `qwen2.5-coder`, `deepseek-r1`, `mistral`, etc.).
- 🌊 **Streaming em Tempo Real (SSE)**: Respostas exibidas de imediato token por token, com interrupção instantânea via botão "Parar".
- 📊 **Monitor HUD de Contexto em Tempo Real**: Barra de progresso com telemetria direta do Ollama (Prompt, RAG, Histórico e Resposta vs. limite `num_ctx`), com indicação visual por cores e detalhamento via popover.
- 🧹 **Gestão & Poda Inteligente de Contexto**: Poda automática de mensagens mais antigas quando a conversa atinge o limite de tokens para evitar falhas de contexto da LLM, com botão "Limpar Ctx" para reiniciar a memória instantaneamente.
- 💻 **Assistente de Código & Modificador de Projetos**:
  - Gerencie projetos de código pelo caminho absoluto local no seu disco.
  - Árvore interativa de diretórios e arquivos com leitor de código integrado.
  - Contextualização automática do projeto direto no prompt do modelo.
  - **Cards Interativos de Diff & Patch**: Visualize alterações cirúrgicas (`SEARCH/REPLACE diff`) ou substituição completa com suporte a aplicação direta no disco e backup automático de segurança (`.bak`).
  - Terminal embutido para execução de comandos e builds diretamente no diretório do projeto.
- 📚 **Motor RAG Embutido**:
  - Ingestão de arquivos `.pdf`, `.md`, `.txt`, `.c`, `.cpp`, `.rs`, `.py`, `.ts`, etc.
  - Chunking inteligente por parágrafos e funções de código.
  - Embeddings vetoriais locais e busca semântica por similaridade de cosseno.
  - Citações de fontes interativas no chat.
- 🪟 **Layout Widescreen & Menu Retrátil**: Chat amplo (`1550px`) com blocos de código sem quebra forçada e botão no cabeçalho para recolher a barra lateral em modo imersivo.
- 🎨 **Syntax Highlighting Completo**: Destaque de código com suporte a C, C++, Assembly (MASM/NASM), Rust, Python, Go, TypeScript, JSON, Bash e mais.
- 💾 **Persistência Atômica**: Histórico de chats, coleções e projetos salvos localmente em JSON de forma atômica.

---

## 🚀 Quick Start (Como Rodar)

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) v18 ou superior instalado.
- [Ollama](https://ollama.com/) instalado e rodando na sua máquina.
- Baixe seus modelos favoritos no terminal:
  ```bash
  # Modelo de Chat recomendado para código e lógica geral
  ollama pull qwen2.5-coder
  # ou
  ollama pull llama3.2

  # Modelo de Embedding da base RAG (multilíngue: pergunte em PT sobre livros em EN)
  ollama pull bge-m3
  ```

### 2. Clonar o Repositório
```bash
git clone https://github.com/CodigoRoxo/PurpleAI-Interface.git
cd PurpleAI-Interface
```

### 3. Instalar Dependências
```bash
npm install
```

### 4. Iniciar a Aplicação

#### Opção A — 1 Clique no Windows:
Dê dois cliques no arquivo:
```cmd
start.bat
```

#### Opção B — 1 Clique no Linux / macOS:
```bash
chmod +x start.sh
./start.sh
```

#### Opção C — Terminal Tradicional:
```bash
npm run dev
```

Abra seu navegador em:  
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🛠️ Modos de Uso

### 1. Chat Básico com Modelos Locais
Selecione qualquer modelo disponível no seu Ollama através do dropdown superior. Digite sua mensagem e receba a resposta em tempo real.

### 2. Usando a Base de Conhecimento (RAG)
1. Navegue até a aba **Knowledge** no menu lateral.
2. Crie uma coleção e faça o upload de documentos (PDFs técnicos, guias, manuais, etc.).
3. Ao conversar no chat com o botão **RAG** ativo, o assistente buscará os trechos mais relevantes dos seus documentos e fundamentará as respostas com base neles.

**Roteamento inteligente por coleção:** organize os documentos em coleções (ex.: *Kernel & Drivers*, *Direito*, *Python*). A cada pergunta, o PurpleAI combina busca semântica (embeddings) com busca por palavra exata (BM25, ótima para identificadores como `IRP_MJ_CREATE`), descobre quais coleções realmente têm a resposta e usa **só elas** no contexto. A mensagem mostra *"Consultando: Kernel & Drivers"*, e o seletor ao lado do botão RAG permite fixar coleções manualmente.

### 3. Usando o Workspace de Projetos (Code Assistant)
1. Acesse a aba **Projects** e clique em **Novo Projeto**.
2. Digite o nome do projeto e o caminho absoluto da pasta no seu disco (ex: `E:\MeusProjetos\App`).
3. O PurpleAI indexará a árvore de arquivos e gerará a base semântica do seu código.
4. No chat, selecione o projeto no dropdown ao lado do botão RAG (ou clique em **"Conversar com este Projeto"**).
5. Peça para a IA explicar partes do código, encontrar bugs ou criar novas funções.
6. Quando a IA sugerir alterações, clique em **"Aplicar Alteração"** no card do arquivo para atualizar o arquivo no seu disco!

---

## 🏗️ Arquitetura do Sistema

```text
┌────────────────────────────────────────┐         ┌────────────────────────────────────────┐
│         Frontend (React 18 + TS)       │         │        Backend (Express + Node.js)     │
│                                        │         │                                        │
│  - Chat Widescreen & Streaming (SSE)   │ ◄─────► │  - SSE Proxy & Ollama Orchestrator     │
│  - HUD Context Progress Monitor        │   SSE   │  - Safe Disk I/O & Automatic .bak      │
│  - FileActionCard (Interactive Diffs)  │   HTTP  │  - Vector Chunker & Cosine Search      │
│  - Projects Explorer & Terminal Drawer │         │  - Smart Context Pruning Engine        │
│  - Knowledge Manager & RAG Inspector   │         │  - Atomic JSON Data Storage            │
└────────────────────────────────────────┘         └───────────────────┬────────────────────┘
                                                                       │
                                                                       ▼
                                                   ┌────────────────────────────────────────┐
                                                   │          Ollama Local Engine           │
                                                   │         (http://localhost:11434)       │
                                                   │                                        │
                                                   │  - Chat LLMs (Qwen, DeepSeek, Llama)   │
                                                   │  - Embeddings (bge-m3, nomic, etc.)    │
                                                   └────────────────────────────────────────┘
```

---

## ⚙️ Variáveis de Ambiente (Opcional)

Caso queira customizar portas ou o endereço do Ollama, você pode configurar um arquivo `.env` no `backend/`:

```env
PORT=3001
HOST=127.0.0.1
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=bge-m3
OLLAMA_NUM_CTX=16384
```

### 🔒 Segurança

O backend lê e grava arquivos dos seus projetos e pode executar comandos de terminal, por isso ele vem travado por padrão:

- Escuta apenas em `127.0.0.1` (não fica visível na rede).
- Só aceita requisições do frontend (`ALLOWED_ORIGINS`) e com `Host` local, o que bloqueia sites maliciosos e ataques de DNS rebinding.
- Arquivos só podem ser lidos/gravados dentro da pasta do projeto (fora de `.git`), e a raiz do disco ou a pasta do usuário não podem virar projeto.

Para acessar de outra máquina da rede, defina **obrigatoriamente** um token (o backend se recusa a iniciar sem ele). O proxy do Vite envia o token automaticamente:

```env
HOST=0.0.0.0
PURPLEAI_API_TOKEN=um-segredo-longo-e-aleatorio
ALLOWED_ORIGINS=http://192.168.0.10:3000
# Comandos de terminal ficam desligados fora do loopback; habilite só se confiar na rede
ALLOW_SHELL_COMMANDS=false
```

---

## 🤝 Contribuições

Contribuições são super bem-vindas! Sinta-se livre para abrir uma **Issue** ou enviar um **Pull Request** com novas ideias, melhorias de desempenho ou integrações.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
