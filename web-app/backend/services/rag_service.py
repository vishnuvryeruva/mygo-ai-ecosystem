import os
import chromadb
from chromadb.config import Settings
from services.openai_service import OpenAIService
import PyPDF2
import io
import zipfile
from docx import Document

# Supported file extensions for extraction from ZIP files
SUPPORTED_EXTENSIONS = {
    # Documents
    '.pdf', '.docx', '.txt', '.md',
    # Code files
    '.py', '.js', '.ts', '.java', '.abap', '.json', '.yaml', '.yml', '.xml'
}

class RAGService:
    def __init__(self):
        self.openai_service = OpenAIService()
        
        # Use OpenAI embeddings instead of SentenceTransformer to avoid HuggingFace network issues
        print("DEBUG: RAG Service initialized with OpenAI embeddings")
        
        # Initialize ChromaDB
        db_path = os.getenv('VECTOR_DB_PATH', './vector_db')
        self.client = chromadb.PersistentClient(path=db_path)
        
        # Get or create collection with new name to force new embedding dimensions
        # OpenAI text-embedding-3-small uses 1536 dimensions (vs 384 for SentenceTransformer)
        self.collection = self.client.get_or_create_collection(
            name="sap_knowledge_base_openai",  # Changed from sap_knowledge_base
            metadata={"description": "SAP knowledge base with OpenAI embeddings (1536 dim)"}
        )
    
    def _create_embedding(self, text):
        """Create embedding using OpenAI's embedding model"""
        try:
            from openai import OpenAI
            # Use longer timeout for slow network connections
            client = OpenAI(
                api_key=os.getenv('OPENAI_API_KEY'),
                timeout=120.0  # 120 second timeout instead of default 10s
            )
            
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"ERROR: Failed to create embedding: {e}")
            raise
    
    def add_placeholder_document(self, doc_metadata):
        """Add a placeholder document to the database (for synced external files)"""
        try:
            filename = doc_metadata.get('name', 'unknown')
            doc_type = doc_metadata.get('type', 'unknown')
            
            # Check for duplicates
            if self.check_duplicate(filename):
                return {"status": "skipped", "message": "Document already exists"}
            
            # Create a placeholder chunk
            placeholder_text = f"External document synced from Cloud ALM. Type: {doc_type}. This is a placeholder for metadata purposes."
            
            # Create embedding
            embedding = self._create_embedding(placeholder_text)
            
            # Add to collection
            self.collection.add(
                embeddings=[embedding],
                documents=[placeholder_text],
                ids=[f"{filename}_0"],  # chunk 0
                metadatas=[{"source": "CALM", "type": doc_type}]
            )
            
            return {"status": "success", "message": "Placeholder added"}
        except Exception as e:
            print(f"Error adding placeholder: {e}")
            return {"status": "error", "error": str(e)}

    def ingest_documents(self, files, max_zip_size=256000):
        """Ingest documents into the vector database
        
        Args:
            files: List of files to ingest
            max_zip_size: Maximum size for ZIP files in bytes (default 250KB = 256000 bytes)
        """
        results = []
        
        for file in files:
            try:
                filename_lower = file.filename.lower()
                
                # Handle ZIP files specially
                if filename_lower.endswith('.zip'):
                    # Check file size for ZIP files
                    file.seek(0, 2)  # Seek to end
                    file_size = file.tell()
                    file.seek(0)  # Reset to beginning
                    
                    if file_size > max_zip_size:
                        results.append({
                            "filename": file.filename,
                            "status": "error",
                            "error": f"ZIP file exceeds 250KB limit ({file_size / 1024:.1f}KB)"
                        })
                        continue
                    
                    # Extract and process ZIP contents
                    zip_results = self._extract_zip(file)
                    results.extend(zip_results)
                    continue
                
                # Check for duplicates
                is_duplicate = self.check_duplicate(file.filename)
                
                # Extract text from file
                text_content = self._extract_text(file)
                
                if not text_content.strip():
                    results.append({
                        "filename": file.filename,
                        "status": "error",
                        "error": "No text content extracted from file"
                    })
                    continue
                
                # Split into chunks
                chunks = self._chunk_text(text_content, chunk_size=500, overlap=50)
                
                # Create embeddings and store
                for i, chunk in enumerate(chunks):
                    embedding = self._create_embedding(chunk)
                    
                    self.collection.add(
                        embeddings=[embedding],
                        documents=[chunk],
                        ids=[f"{file.filename}_{i}"]
                    )
                
                results.append({
                    "filename": file.filename,
                    "chunks": len(chunks),
                    "status": "success",
                    "was_duplicate": is_duplicate
                })
            except Exception as e:
                results.append({
                    "filename": file.filename,
                    "status": "error",
                    "error": str(e)
                })
        
        return results
    
    def check_duplicate(self, filename):
        """Check if a document with the same filename already exists"""
        try:
            result = self.collection.get()
            ids = result['ids']
            
            # Check if any ID starts with the filename
            for id in ids:
                if id.startswith(f"{filename}_"):
                    return True
            return False
        except Exception as e:
            print(f"Error checking duplicate: {e}")
            return False
    
    def query(self, query_text, top_k=5, custom_prompt=None):
        """Query the RAG system"""
        # Encode query using OpenAI embeddings
        query_embedding = self._create_embedding(query_text)
        
        # Search similar documents
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        
        # Build context from retrieved documents
        context = "\n\n".join(results['documents'][0])
        
        # Generate answer using OpenAI with context
        # Use custom prompt if provided, otherwise use default from config
        if custom_prompt:
            system_prompt = custom_prompt
        else:
            try:
                from config.prompts import get_prompt
                system_prompt = get_prompt('ask_yoda', 'system')
                if not system_prompt:
                    # Fallback to default
                    system_prompt = """You are Yoda, a wise AI assistant with access to a knowledge base of SAP documents. 
                    Answer questions based on the provided context. If the context doesn't contain enough information, say so clearly."""
            except:
                system_prompt = """You are an expert SAP consultant and developer. 
                Answer questions based on the provided context from documents, test scripts, and tickets.
                If the context doesn't contain enough information, say so clearly.
                Provide clear, concise, and accurate answers."""
        
        user_prompt = f"""Context from knowledge base:
{context}

Question: {query_text}

Please provide a comprehensive answer based on the context above."""
        
        answer = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=1000
        )
        
        return answer
    
    def list_documents(self):
        """List all documents in the database with metadata"""
        # Get all documents from collection
        # Note: ChromaDB doesn't have a direct "list all source files" method efficiently
        # So we'll get all metadata and extract unique filenames
        
        try:
            result = self.collection.get()
            ids = result['ids']
            documents = result.get('documents', [])
            
            # Extract unique filenames and count chunks
            file_info = {}
            for i, id in enumerate(ids):
                # Assuming id format is filename_chunkIndex
                parts = id.rsplit('_', 1)
                if len(parts) > 0:
                    filename = parts[0]
                    if filename not in file_info:
                        file_info[filename] = {
                            'name': filename,
                            'type': self._get_file_type(filename),
                            'chunks': 0,
                            'estimated_size': 0
                        }
                    file_info[filename]['chunks'] += 1
                    # Estimate size from document content
                    if i < len(documents):
                        file_info[filename]['estimated_size'] += len(documents[i])
            
            # Convert to list with formatted size
            doc_list = []
            for filename, info in file_info.items():
                size_kb = info['estimated_size'] / 1024
                doc_list.append({
                    'name': info['name'],
                    'type': info['type'],
                    'size': f"{size_kb:.1f} KB" if size_kb >= 1 else f"{info['estimated_size']} bytes",
                    'chunks': info['chunks'],
                    # Note: ChromaDB doesn't store upload timestamp, so we can't provide actual dates
                    # In a production system, you'd store this in metadata during ingest
                    'uploadDate': 'N/A'
                })
            
            return doc_list
        except Exception as e:
            print(f"Error listing documents: {e}")
            return []
    
    def _get_file_type(self, filename):
        """Get file type from filename extension"""
        ext = filename.lower().split('.')[-1] if '.' in filename else 'unknown'
        type_map = {
            'pdf': 'PDF',
            'docx': 'Word',
            'doc': 'Word',
            'txt': 'Text',
            'md': 'Markdown',
            'py': 'Python',
            'js': 'JavaScript',
            'ts': 'TypeScript',
            'java': 'Java',
            'abap': 'ABAP',
            'json': 'JSON',
            'yaml': 'YAML',
            'yml': 'YAML',
            'xml': 'XML'
        }
        return type_map.get(ext, ext.upper())

    def delete_document(self, filename):
        """Delete a document from the database"""
        try:
            # Delete all chunks associated with this filename
            # We need to find IDs that start with the filename
            # This is a bit tricky with ChromaDB's delete, so we'll use a where clause on metadata if possible
            # But we didn't store filename in metadata in ingest_documents (my bad)
            # So we have to rely on ID matching
            
            # First, get all IDs
            result = self.collection.get()
            ids = result['ids']
            
            ids_to_delete = [id for id in ids if id.startswith(f"{filename}_")]
            
            if ids_to_delete:
                self.collection.delete(ids=ids_to_delete)
                return True
            return False
        except Exception as e:
            print(f"Error deleting document: {e}")
            return False

    def _extract_zip(self, file):
        """Extract and process files from a ZIP archive"""
        results = []
        
        try:
            zip_data = io.BytesIO(file.read())
            with zipfile.ZipFile(zip_data, 'r') as zip_ref:
                for zip_info in zip_ref.filelist:
                    # Skip directories
                    if zip_info.is_dir():
                        continue
                    
                    inner_filename = zip_info.filename
                    _, ext = os.path.splitext(inner_filename.lower())
                    
                    # Only process supported file types
                    if ext not in SUPPORTED_EXTENSIONS:
                        continue
                    
                    try:
                        # Read file content from ZIP
                        file_content = zip_ref.read(inner_filename)
                        
                        # Process the file content
                        text_content = self._process_zip_content(inner_filename, file_content)
                        
                        if not text_content.strip():
                            continue
                        
                        # Check for duplicates
                        base_name = os.path.basename(inner_filename)
                        is_duplicate = self.check_duplicate(base_name)
                        
                        # Split into chunks
                        chunks = self._chunk_text(text_content, chunk_size=500, overlap=50)
                        
                        # Create embeddings and store
                        for i, chunk in enumerate(chunks):
                            embedding = self._create_embedding(chunk)
                            
                            self.collection.add(
                                embeddings=[embedding],
                                documents=[chunk],
                                ids=[f"{base_name}_{i}"]
                            )
                        
                        results.append({
                            "filename": f"{file.filename}/{inner_filename}",
                            "chunks": len(chunks),
                            "status": "success",
                            "was_duplicate": is_duplicate
                        })
                    except Exception as e:
                        results.append({
                            "filename": f"{file.filename}/{inner_filename}",
                            "status": "error",
                            "error": str(e)
                        })
        except zipfile.BadZipFile:
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": "Invalid ZIP file"
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": str(e)
            })
        
        return results
    
    def _process_zip_content(self, filename, content):
        """Process file content extracted from ZIP"""
        filename_lower = filename.lower()
        
        if filename_lower.endswith('.pdf'):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text
        elif filename_lower.endswith('.docx'):
            doc = Document(io.BytesIO(content))
            return "\n".join([p.text for p in doc.paragraphs])
        else:
            # Try to decode as text (txt, md, py, js, etc.)
            try:
                return content.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    return content.decode('latin-1')
                except:
                    return ""
    
    def _extract_text(self, file):
        """Extract text from various file types"""
        filename = file.filename.lower()
        
        if filename.endswith('.pdf'):
            return self._extract_pdf(file)
        elif filename.endswith('.docx'):
            return self._extract_docx(file)
        elif filename.endswith('.txt') or filename.endswith('.md'):
            return file.read().decode('utf-8')
        else:
            # Try to read as text (for code files, etc.)
            try:
                return file.read().decode('utf-8')
            except:
                return ""
    
    def _extract_pdf(self, file):
        """Extract text from PDF"""
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file.read()))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    
    def _extract_docx(self, file):
        """Extract text from DOCX"""
        doc = Document(io.BytesIO(file.read()))
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text
    
    def _chunk_text(self, text, chunk_size=500, overlap=50):
        """Split text into overlapping chunks"""
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk = ' '.join(words[i:i + chunk_size])
            chunks.append(chunk)
        
        return chunks

