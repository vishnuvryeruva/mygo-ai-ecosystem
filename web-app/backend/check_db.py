import sys
import os
import json

# Add current directory (backend) to path
sys.path.append(os.getcwd())

from services.rag_service import RAGService

def check_db():
    print("Initializing RAG Service...")
    rag = RAGService()
    
    docs = rag.list_documents()
    print(f"Found {len(docs)} documents in DB:")
    for doc in docs:
        print(f"- {doc['name']} (Type: {doc.get('type')}, Source: {doc.get('source')}, Chunks: {doc.get('chunks')})")

if __name__ == "__main__":
    check_db()
