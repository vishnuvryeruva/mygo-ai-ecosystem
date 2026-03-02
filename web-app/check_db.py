import sys
import os
import json

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from services.rag_service import RAGService

def check_db():
    print("Initializing RAG Service...")
    rag = RAGService()
    
    docs = rag.list_documents()
    print(f"Found {len(docs)} documents in DB:")
    for doc in docs:
        print(f"- {doc['name']} (Type: {doc.get('type')}, Source: {doc.get('source')})")
        
    print("\nFetching raw collection details...")
    result = rag.collection.get()
    
    print(f"Number of chunks: {len(result['ids'])}")
    if len(result['ids']) > 0:
        print("\nDetails of first 5 chunks:")
        for i in range(min(5, len(result['ids']))):
            print(f"Chunk {i+1}:")
            print(f"  ID: {result['ids'][i]}")
            
            meta = result['metadatas'][i] if result['metadatas'] and len(result['metadatas']) > i else {}
            print(f"  Metadata: {json.dumps(meta)}")

if __name__ == "__main__":
    check_db()
