# 🚀 MYGO AI Ecosystem — New Team Member Onboarding

Welcome to the team! This guide will get you up to speed on the **MYGO AI Ecosystem** — an AI-powered SAP development assistant built with modern web technologies and OpenAI.

---

## What is MYGO?

MYGO is a web application that helps SAP consultants and developers work smarter using **AI (GPT-4o-mini)** and **RAG (Retrieval Augmented Generation)**. It's an internal AI toolkit specifically built for SAP workflows — from querying historical project documents to generating specs and analyzing ABAP code.

---

## AI Tools Overview

| Tool | What It Does |
|---|---|
| **Ask Yoda** | RAG-based Q&A — query historical blueprints, specs, tickets, and test cases from an embedded knowledge base |
| **Solution Advisor** | Conversational advisor that gathers requirements, explores existing solutions, and prepares context for spec generation |
| **Spec Assistant** | Generate functional and technical specification documents with AI; export to DOCX or PDF |
| **Prompt Generator** | Create optimized prompts for LLM code generation across ABAP, Python, JavaScript, Java, and TypeScript |
| **Explain Code** | Get intelligent AI explanations for ABAP programs, classes, or functions |
| **Test Case Generator** | Generate manual test cases and ABAP Unit test skeletons; export to Excel, Word, or Jira/Xray |
| **Code Advisor** | Analyze code for anti-patterns with diff-style improvement suggestions and severity levels |
| **Source Configuration** | Connect to Cloud ALM, SharePoint, or SolMan to sync documents into the knowledge base |

---

## Architecture

```
┌──────────────────────────────────────┐
│   Frontend (Next.js 14 + React)      │  ← http://localhost:3000
│   TypeScript, Tailwind CSS           │
└────────────────┬─────────────────────┘
                 │  REST API calls
┌────────────────▼─────────────────────┐
│   Backend (Python Flask)             │  ← http://localhost:5000
│   ├── OpenAI API (GPT-4o-mini)       │
│   ├── ChromaDB (Vector Database)     │
│   └── Sentence Transformers          │
│       (all-MiniLM-L6-v2 embeddings)  │
└──────────────────────────────────────┘
```

### How RAG Works
1. **Ingest** — Documents (PDF, DOCX, TXT) are uploaded and embedded into vectors using Sentence Transformers
2. **Store** — Vectors are persisted in ChromaDB (local, under `vector_db/`)
3. **Query** — User questions are embedded and matched against stored documents via semantic search
4. **Generate** — Relevant context is retrieved and fed to OpenAI to produce accurate, grounded answers

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Axios |
| **Backend** | Python 3.9+, Flask 3.0, CORS |
| **AI/ML** | OpenAI API (GPT-4o-mini), Sentence Transformers |
| **Vector DB** | ChromaDB (persistent local storage) |
| **Document Processing** | PyPDF2, python-docx, openpyxl |

---

## Project Structure

```
mygo-ai-ecosystem-main/
├── web-app/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Main entry point (dashboard, routing, modals)
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css               # Global styles & design system
│   │
│   ├── components/                   # React components
│   │   ├── Sidebar.tsx               # Navigation sidebar
│   │   ├── ChatbotWidget.tsx         # "Ask Yoda" floating chatbot
│   │   ├── FeatureCard.tsx           # Dashboard feature cards
│   │   ├── DashboardLayout.tsx       # Page layout wrapper
│   │   ├── QuickActionsFAB.tsx       # Floating action button
│   │   ├── RichTextResponse.tsx      # Markdown response renderer
│   │   ├── modals/                   # One modal per AI tool
│   │   │   ├── SolutionAdvisorModal.tsx
│   │   │   ├── SpecAssistantModal.tsx
│   │   │   ├── PromptGeneratorModal.tsx
│   │   │   ├── ExplainCodeModal.tsx
│   │   │   ├── TestCaseGeneratorModal.tsx
│   │   │   ├── CodeAdvisorModal.tsx
│   │   │   ├── DocumentUploadModal.tsx
│   │   │   └── SettingsModal.tsx
│   │   └── pages/                    # Full-page views
│   │       ├── SourcesPage.tsx
│   │       └── DocumentUploadPage.tsx
│   │
│   ├── context/                      # React context providers
│   │
│   ├── backend/                      # Python Flask backend
│   │   ├── app.py                    # Main Flask app — all API routes
│   │   ├── mcp_server.py             # Model Context Protocol server
│   │   ├── services/                 # Business logic layer
│   │   │   ├── openai_service.py     # OpenAI API wrapper
│   │   │   ├── rag_service.py        # RAG pipeline (embed, store, query)
│   │   │   ├── spec_service.py       # Spec document generation
│   │   │   ├── prompt_service.py     # Prompt optimization
│   │   │   ├── code_service.py       # Code explanation
│   │   │   ├── test_service.py       # Test case generation
│   │   │   ├── advisor_service.py    # Code analysis
│   │   │   ├── calm_service.py       # Cloud ALM integration
│   │   │   ├── source_config_service.py  # Data source management
│   │   │   └── markdown_utils.py     # Markdown rendering utilities
│   │   └── agents/                   # AI agent logic
│   │       ├── solution_advisor.py   # Multi-turn conversation agent
│   │       ├── ask_yoda.py           # RAG query agent
│   │       ├── spec_assistant.py     # Spec generation agent
│   │       ├── prompt_generator.py   # Prompt optimization agent
│   │       ├── explain_code.py       # Code explanation agent
│   │       ├── generate_tests.py     # Test generation agent
│   │       ├── analyze_code.py       # Code analysis agent
│   │       └── refactor_code.py      # Code refactoring agent
│   │
│   ├── .env                          # Environment variables (DO NOT COMMIT)
│   ├── package.json                  # Frontend dependencies
│   ├── requirements.txt              # Backend dependencies
│   └── tailwind.config.js            # Tailwind configuration
│
└── abap-ai-assistant-tutorial/       # Eclipse plugin (companion project)
```

---

## Getting Started

### Prerequisites
- **Node.js** (v18+ recommended)
- **Python 3.9+**
- **Git**

### 1. Clone & Setup Backend

```bash
cd web-app/backend
python3 -m venv venv
source venv/bin/activate            # On Windows: venv\Scripts\activate
pip install -r ../requirements.txt
```

### 2. Configure Environment

The `.env` file in `web-app/` contains:
```
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-4o-mini
FLASK_PORT=5000
VECTOR_DB_PATH=./vector_db
```

> ⚠️ **Never commit the `.env` file.** Ask the team lead for the current API key.

### 3. Start the Backend

```bash
cd web-app/backend
python app.py                       # → http://localhost:5000
```

### 4. Start the Frontend

```bash
cd web-app
npm install
npm run dev                         # → http://localhost:3000
```

Or use the convenience scripts:
```bash
./start-backend.sh   # Terminal 1
./start-frontend.sh  # Terminal 2
```

---

## API Endpoints

All endpoints are prefixed with `/api/`:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ask-yoda` | Query the RAG knowledge base |
| `POST` | `/api/upload-documents` | Upload documents for RAG ingestion |
| `POST` | `/api/generate-spec` | Generate specification documents |
| `POST` | `/api/generate-prompt` | Generate optimized prompts |
| `POST` | `/api/explain-code` | Explain code functionality |
| `POST` | `/api/generate-test-cases` | Generate test cases |
| `POST` | `/api/analyze-code` | Analyze code for improvements |
| `GET`  | `/api/health` | Health check |

---

## Development Patterns

### Frontend Pattern
- Each AI tool has a **modal component** in `components/modals/`
- Modals are opened/closed via state in `page.tsx`
- API calls use **Axios** to `http://localhost:5000/api/*`

### Backend Pattern
- Routes are defined in `app.py`
- Each route delegates to the corresponding **service** (business logic) and/or **agent** (AI logic)
- Services handle external integrations (OpenAI, ChromaDB, file processing)
- Agents handle prompt engineering and multi-turn conversations

### Adding a New Feature
1. Create a new service in `backend/services/`
2. Create a new agent in `backend/agents/`
3. Add the API route in `backend/app.py`
4. Build the modal component in `components/modals/`
5. Wire it up in `page.tsx`

---

## Important Notes

- **No authentication yet** — this is on the roadmap, so be aware that all endpoints are currently open
- **Vector DB is local** — stored in `backend/vector_db/` and persists between sessions
- **Model is configurable** — defaults to `gpt-4o-mini` but can be changed in `.env`
- **MCP Server** — `mcp_server.py` provides Model Context Protocol support for advanced AI agent integration
- **Eclipse Plugin** — The `abap-ai-assistant-tutorial/` directory contains a companion Eclipse plugin that can share the same backend

---

## Current Roadmap

- [] SAP code fetching integration (RFC/OData/ADT)
- [ ] User authentication & access control
- [ ] Enhanced document management UI
- [ ] PDF export for specifications
- [ ] Advanced RAG fine-tuning for SAP-specific content
- [ ] Team collaboration & shared knowledge bases
- [ ] Usage analytics and suggestion improvements

---

## Questions?

Reach out to the team lead or check the `README.md` and `PROJECT_SUMMARY.md` files for additional details.

**Welcome aboard! 🎉**
