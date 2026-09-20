<div align="center">

# 🟣 PurpleAI Interface

**A Modern, Privacy-First Local AI Web Interface & Code Assistant powered by Ollama and RAG.**

🌐 **[ENGLISH VERSION]** • 🇧🇷 **[Versão em Português](README.md)**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-emerald.svg)](https://nodejs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Engine-black?logo=ollama)](https://ollama.com/)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

[Overview](#-overview) • [Features](#-features) • [Screenshots](#-screenshots) • [Quick Start](#-quick-start) • [Usage Modes](#-usage-modes) • [Architecture](#-system-architecture) • [Disclaimer](#-design--ai-slop-disclaimer)

---

</div>

## 📌 Keywords / SEO Tags
`Local LLM` • `Ollama Web UI` • `RAG (Retrieval-Augmented Generation)` • `Local AI Assistant` • `Vector Search` • `AI Code Assistant` • `Private AI` • `Self-Hosted LLM` • `Offline AI` • `Developer Workspace` • `Open Source LLM Interface`

---

## 📖 Overview

**PurpleAI Interface** is an open-source, fully self-hosted web application to run, manage, and interact with **Local Large Language Models (LLMs)** powered by **Ollama**. No cloud dependencies, no subscription fees, and **100% data privacy**.

Beyond a smooth real-time streaming chat, PurpleAI includes:
1. **RAG Knowledge Base (Retrieval-Augmented Generation)**: Ingest PDFs, Markdown notes, text, and source code into your own local vector store to ground LLM answers with relevant citations.
2. **Project Workspace & Code Assistant**: Connect local code repositories, explore directory trees, perform semantic code search, and let the AI propose code modifications that you can write directly to disk with a single click (**1-Click Apply**, backed by automatic `.bak` safety backups).

> ⚠️ **Open Source Notice:** This project is completely free and unopinionated. It was built for developers who want a local, self-hosted foundation to interact with Ollama models and build their own custom knowledge bases or code assistants without vendor lock-in.

---

## 📸 Screenshots

<div align="center">

### 💬 Streaming Local LLM Chat
*Clean interface with token-by-token streaming, model selector, and Ollama status detection*
```
[Add your screenshot at: docs/screenshots/chat.png]
```
![Chat Interface](docs/screenshots/chat.png)

---

### 🧠 Vector RAG Knowledge Base
*Document uploads, intelligent chunking, fast cosine vector search, and diagnostic inspect modal*
```
[Add your screenshot at: docs/screenshots/knowledge.png]
```
![Knowledge Base](docs/screenshots/knowledge.png)

---

### 🛠️ Project Workspace & 1-Click Code Editor
*Interactive directory tree, syntax highlighted viewer, and actionable code cards to apply edits on disk*
```
[Add your screenshot at: docs/screenshots/projects.png]
```
![Projects Workspace](docs/screenshots/projects.png)

</div>

---

## ⚡ Key Features

- 🔒 **100% Local & Private**: Zero telemetry, zero external network calls. Everything runs exclusively on your local machine.
- ⚡ **Automatic Ollama Synchronization**: Automatically detects running Ollama instances and lists installed models (`llama3.2`, `qwen2.5-coder`, `deepseek-r1`, `mistral`, etc.).
- 🌊 **Real-Time Streaming (SSE)**: Fast, token-by-token streaming response with an instant "Stop" cancellation button.
- 📚 **Built-in Vector RAG Engine**:
  - Ingestion for `.pdf`, `.md`, `.txt`, `.c`, `.cpp`, `.rs`, `.py`, `.ts`, and more.
  - Smart paragraph and code-aware chunking.
  - Local vector embeddings and cosine similarity search.
  - Interactive source citation modal in chat messages.
- 💻 **Local Code Assistant & Project Workspace**:
  - Connect local directories by path.
  - Interactive file tree with embedded syntax highlighted code viewer.
  - Contextualizes your active project code directly in the system prompt.
  - **File Action Cards**: When the model proposes a file modification or creation, an interactive **"Apply to Disk"** button writes the changes to your local file system and automatically creates a `.bak` safety backup before incrementally updating the vector index.
- 🎨 **Rich Syntax Highlighting**: Powered by Highlight.js with dark cyber themes for C, C++, Assembly (MASM/NASM), Rust, Python, Go, TypeScript, JSON, Bash, and more.
- 💾 **Safe Atomic Storage**: Conversations, collections, and projects are persisted locally in lightweight JSON files.

---

## 🤖 Design & "AI Slop" Disclaimer

> **Yes, the visual interface of this project was generated with the assistance of Artificial Intelligence.**  
> If you notice that quintessential futuristic "AI Slop" aesthetic (lots of purple neon, cyberpunk gradients, and translucent glassmorphism cards), now you know why! 😄  
> The primary goal was to build a tool that is highly functional, snappy, and enjoyable to use every day with full focus on usability, high contrast, and code readability. Feel free to tweak or customize the design in `frontend/src/styles/theme.css`.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher installed.
- [Ollama](https://ollama.com/) installed and running locally (`http://localhost:11434`).
- At least one chat model and one embedding model pulled in Ollama:
  ```bash
  # Recommended Chat Model (great for general reasoning and code)
  ollama pull qwen2.5-coder
  # or
  ollama pull llama3.2

  # Recommended Embedding Model for RAG
  ollama pull all-minilm
  ```

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/PurpleAI.Interface.git
cd PurpleAI.Interface
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Launch the Application

#### Option A — 1-Click Launch on Windows:
Double-click:
```cmd
start.bat
```

#### Option B — 1-Click Launch on Linux / macOS:
```bash
chmod +x start.sh
./start.sh
```

#### Option C — Terminal:
```bash
npm run dev
```

This starts both services concurrently:
- **Backend API**: `http://localhost:3001`
- **Frontend UI**: `http://localhost:3000`

Open your browser at:  
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🛠️ Usage Modes

### 1. General Local Chat
Select any model available in your local Ollama instance via the top navigation dropdown. Type your prompt and stream responses in real-time.

### 2. RAG Knowledge Base
1. Open the **Knowledge Base** tab in the sidebar.
2. Create a collection and upload your files (PDFs, manuals, documentation, guides).
3. Chat with the **RAG** toggle enabled. The assistant will search the relevant chunks and cite exact sources in its response.

### 3. Project Workspace & Code Assistant
1. Open the **Projects** tab and click **New Project**.
2. Enter a project name and its absolute folder path (e.g., `C:\Projects\MyRepo` or `/home/user/projects/my-repo`).
3. PurpleAI indexes the file tree and generates semantic code vectors.
4. Select the project in the chat dropdown (or click **"Chat with Project"**).
5. Ask the AI to diagnose issues, refactor functions, or generate modules.
6. When the AI proposes an edit, click **"Apply to Disk"** directly on the file card to update your source file on disk!

---

## 🏗️ System Architecture

```text
┌───────────────────────────┐         ┌───────────────────────────┐
│   Frontend (React + TS)   │         │    Backend (Express + TS) │
│                           │         │                           │
│  - Chat Area & Streaming  │ ◄─────► │  - SSE Stream Proxy       │
│  - FileActionCard (Apply) │   SSE   │  - Safe File System I/O   │
│  - Projects Workspace     │   HTTP  │  - Chunker & Vector RAG   │
│  - Knowledge Manager      │         │  - Atomic JSON Storage    │
└───────────────────────────┘         └─────────────┬─────────────┘
                                                    │
                                                    ▼
                                      ┌───────────────────────────┐
                                      │    Ollama Local Engine    │
                                      │    (http://localhost:11434)│
                                      │                           │
                                      │  - Chat Models (LLMs)     │
                                      │  - Embeddings (all-minilm)│
                                      │  - Streaming Generation   │
                                      └───────────────────────────┘
```

---

## ⚙️ Environment Variables (Optional)

To override default ports or Ollama endpoints, create a `.env` file in `backend/`:

```env
PORT=3001
HOST=0.0.0.0
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=all-minilm
```

---

## 🤝 Contributing

Contributions are very welcome! Feel free to open an **Issue** or submit a **Pull Request** with bug fixes, features, or UI improvements.

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more details.
