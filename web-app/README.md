# MYGO SAP AI Assistant - Web Application

AI-Powered SAP Intelligence Web Application with RAG capabilities.

## Features

1. **Ask Yoda** - RAG-based Q&A system for querying historical blueprints, specs, tickets, and test cases
2. **Spec Assistant** - Generate functional and technical specification documents
3. **Prompt Generator** - Create optimized prompts for LLM code generation
4. **Explain Code** - Get intelligent explanations for ABAP code
5. **Test Case Generator** - Generate manual test cases and ABAP Unit test skeletons
6. **Code Advisor** - Analyze code for anti-patterns and improvements

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Python Flask, OpenAI API
- **Vector Database**: ChromaDB
- **Embeddings**: Sentence Transformers

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r ../requirements.txt
```

4. Create `.env` file in the root directory:
```bash
cp ../.env.example .env
```

5. Update `.env` with your OpenAI API key (already included from screenshots)

6. Run the backend:
```bash
python app.py
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to web-app directory:
```bash
cd web-app
```

2. Install dependencies:
```bash
npm install
```

3. Copy the Mygo logotype to the public directory:
```bash
cp "../Mygo logotype.png" public/
```

4. Run the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

- `POST /api/ask-yoda` - Query the RAG system
- `POST /api/upload-documents` - Upload documents for RAG ingestion
- `POST /api/generate-spec` - Generate specification documents
- `POST /api/generate-prompt` - Generate optimized prompts
- `POST /api/explain-code` - Explain code functionality
- `POST /api/generate-test-cases` - Generate test cases
- `POST /api/analyze-code` - Analyze code for improvements

## Architecture

The application follows a RAG (Retrieval Augmented Generation) architecture:

1. **Data Ingestion**: Documents are embedded and stored in ChromaDB vector database
2. **Query Processing**: User queries are embedded and matched against stored documents
3. **Response Generation**: Relevant context is retrieved and used to generate answers via OpenAI

## Notes

- The OpenAI API key from the screenshots is included in `.env.example`
- Vector database is stored locally in `./vector_db` directory
- All services use GPT-4o-mini by default (configurable in `.env`)

