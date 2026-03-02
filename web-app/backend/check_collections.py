import sys
import os

sys.path.append(os.getcwd())
try:
    from services.rag_service import RAGService
    rag = RAGService()
    print("Collections in DB:")
    for collection in rag.client.list_collections():
        print(f"- {collection.name}")
        col = rag.client.get_collection(collection.name)
        res = col.get()
        print(f"  Total chunks: {len(res['ids'])}")
        if len(res['ids']) > 0:
            print(f"  First few ids: {res['ids'][:3]}")
except Exception as e:
    import traceback
    traceback.print_exc()
