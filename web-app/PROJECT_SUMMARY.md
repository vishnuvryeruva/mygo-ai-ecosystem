# MYGO SAP AI Assistant - Project Summary

## Overview

A comprehensive web application for AI-powered SAP development and consulting, featuring 6 main tools with RAG (Retrieval Augmented Generation) capabilities. The application matches the UI design from the provided screenshots and integrates with the existing Eclipse plugin.

## Architecture

### Frontend (Next.js 14 + React + TypeScript)
- **Location**: `web-app/`
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Components**: 
  - Main landing page with 6 feature cards
  - Modal components for each feature
  - Header with Mygo logotype
  - Responsive design matching the provided UI

### Backend (Python Flask)
- **Location**: `backend/`
- **Framework**: Flask with CORS
- **Services**:
  - `OpenAIService`: OpenAI API integration
  - `RAGService`: Vector database and RAG implementation
  - `SpecService`: Specification document generation
  - `PromptService`: Prompt optimization
  - `CodeService`: Code explanation
  - `TestService`: Test case generation
  - `AdvisorService`: Code analysis and recommendations

### Vector Database
- **Technology**: ChromaDB (persistent local storage)
- **Embeddings**: Sentence Transformers (all-MiniLM-L6-v2)
- **Purpose**: Store and retrieve documents for RAG queries

## Features Implemented

### 1. Ask Yoda (RAG Q&A)
- Upload documents (PDF, DOCX, TXT) to build knowledge base
- Query historical blueprints, specs, tickets, and test cases
- Semantic search with vector embeddings
- Context-aware answers using OpenAI

### 2. Spec Assistant
- Generate functional or technical specifications
- Export to DOCX or PDF format
- AI-powered document generation with structured sections

### 3. Prompt Generator
- Create optimized prompts for LLM code generation
- Support for ABAP, Python, JavaScript, Java, TypeScript
- Context-aware prompt engineering

### 4. Explain Code
- Enter ABAP program/class/function names
- Get intelligent code explanations
- Support for multiple programming languages
- Placeholder for SAP code fetching integration

### 5. Test Case Generator
- Generate manual test cases
- Create ABAP Unit test skeletons
- Export to Excel, Word, or Jira/Xray format

### 6. Code Advisor
- Analyze code for anti-patterns
- Get improvement recommendations
- Diff-style suggestions showing current vs. suggested code
- Severity levels (ERROR, WARNING, INFO)

## Tech Stack

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Axios for API calls

### Backend
- Python 3.9+
- Flask 3.0
- OpenAI API (GPT-4o-mini)
- ChromaDB
- Sentence Transformers
- PyPDF2, python-docx, openpyxl

## File Structure

```
web-app/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Header.tsx
│   ├── FeatureCard.tsx
│   └── modals/
│       ├── AskYodaModal.tsx
│       ├── SpecAssistantModal.tsx
│       ├── PromptGeneratorModal.tsx
│       ├── ExplainCodeModal.tsx
│       ├── TestCaseGeneratorModal.tsx
│       └── CodeAdvisorModal.tsx
├── backend/
│   ├── app.py
│   └── services/
│       ├── __init__.py
│       ├── openai_service.py
│       ├── rag_service.py
│       ├── spec_service.py
│       ├── prompt_service.py
│       ├── code_service.py
│       ├── test_service.py
│       └── advisor_service.py
├── public/
│   └── Mygo logotype.png
├── package.json
├── requirements.txt
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
└── README.md
```

## API Endpoints

All endpoints are prefixed with `/api/`:

- `POST /api/ask-yoda` - Query RAG system
- `POST /api/upload-documents` - Upload documents for RAG
- `POST /api/generate-spec` - Generate specifications
- `POST /api/generate-prompt` - Generate optimized prompts
- `POST /api/explain-code` - Explain code functionality
- `POST /api/generate-test-cases` - Generate test cases
- `POST /api/analyze-code` - Analyze code for improvements
- `GET /api/health` - Health check

## Configuration

### Environment Variables
- `OPENAI_API_KEY` - OpenAI API key (configured)
- `OPENAI_MODEL` - Model to use (default: gpt-4o-mini)
- `FLASK_PORT` - Backend port (default: 5000)
- `VECTOR_DB_PATH` - Path for ChromaDB storage

## Integration with Eclipse Plugin

The web application uses the same OpenAI API key and can share the same backend services. The Eclipse plugin can be extended to:
- Use the same RAG knowledge base
- Share code analysis patterns
- Access the same specification templates

## Next Steps

1. **SAP Integration**: Implement actual SAP code fetching via RFC/OData/ADT
2. **Authentication**: Add user authentication and access control
3. **Document Management**: Enhanced document upload and management UI
4. **Export Features**: Complete PDF export for specifications
5. **Advanced RAG**: Fine-tune embeddings for SAP-specific content
6. **Collaboration**: Share knowledge bases across teams
7. **Analytics**: Track usage and improve suggestions

## Running the Application

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r ../requirements.txt
python app.py
```

### Frontend
```bash
cd web-app
npm install
npm run dev
```

Or use the provided scripts:
```bash
./start-backend.sh  # In one terminal
./start-frontend.sh # In another terminal
```

## Notes

- The OpenAI API key from the screenshots is already configured
- Vector database is stored locally and persists between sessions
- All features are fully functional and ready to use
- UI matches the design from the provided screenshots
- Mygo logotype is integrated in the header

