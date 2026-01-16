# Setup Guide for MYGO SAP AI Assistant

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- OpenAI API Key (already configured in .env)

## Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r ../requirements.txt

# The .env file is already created with the API key
# Run the backend server
python app.py
```

Backend will be available at `http://localhost:5000`

### 2. Frontend Setup

```bash
# Navigate to web-app directory (from project root)
cd web-app

# Install Node dependencies
npm install

# Run the development server
npm run dev
```

Frontend will be available at `http://localhost:3000`

## Features Overview

### Ask Yoda (RAG Q&A)
- Upload documents (PDF, DOCX, TXT) to build knowledge base
- Query historical blueprints, specs, tickets, and test cases
- Powered by ChromaDB vector database and OpenAI

### Spec Assistant
- Generate functional or technical specifications
- Export to DOCX or PDF format
- AI-powered document generation

### Prompt Generator
- Create optimized prompts for LLM code generation
- Support for ABAP, Python, JavaScript, and more
- Context-aware prompt engineering

### Explain Code
- Enter ABAP program/class/function names
- Get intelligent code explanations
- Support for multiple programming languages

### Test Case Generator
- Generate manual test cases
- Create ABAP Unit test skeletons
- Export to Excel, Word, or Jira/Xray format

### Code Advisor
- Analyze code for anti-patterns
- Get improvement recommendations
- Diff-style suggestions for code improvements

## Troubleshooting

### Backend Issues

1. **Import errors**: Make sure all Python dependencies are installed
   ```bash
   pip install -r requirements.txt
   ```

2. **OpenAI API errors**: Check that the API key in `.env` is valid

3. **ChromaDB errors**: The vector database will be created automatically in `./vector_db`

### Frontend Issues

1. **Module not found**: Run `npm install` again

2. **API connection errors**: Make sure the backend is running on port 5000

3. **Image not loading**: Ensure `Mygo logotype.png` is in the `public/` directory

## Development Notes

- The application uses Next.js 14 with App Router
- Backend uses Flask with CORS enabled
- Vector database (ChromaDB) stores embeddings locally
- All AI features use OpenAI GPT-4o-mini by default

