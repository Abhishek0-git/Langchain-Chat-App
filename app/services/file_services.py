from fastapi import HTTPException, Form, UploadFile, File
from fastapi.concurrency import run_in_threadpool
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader, PyMuPDFLoader
from pathlib import Path
import os
from services.vector_store import embedding_model
from core.database import create_uploaded_file, create_document_chunk, create_message

UPLOAD_DIR = Path("uploaded_files")
UPLOAD_DIR.mkdir(exist_ok=True)

def process_documents(file_id: int, file_path: Path):
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        loader = PyMuPDFLoader(str(file_path))
    elif suffix == ".txt":
        loader = TextLoader(str(file_path), encoding="utf-8", autodetect_encoding=True)
    else:
        raise ValueError("Invalid file type")
        
    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=50)
    chunks = text_splitter.split_documents(documents)
    
    for i, chunk in enumerate(chunks):
        embedding_chunk = embedding_model.embed_query(chunk.page_content)
        create_document_chunk(
            file_id=file_id,
            chunk_content=chunk.page_content,
            embedding=embedding_chunk,
            chunk_number=i, 
        )

async def upload_documents(session_id: str = Form(...), file: UploadFile = File(...)):
    file_name = session_id + "_" + file.filename
    destination_path = UPLOAD_DIR / file_name
    contents = await file.read()
    with open(destination_path, "wb") as buffer:
        buffer.write(contents)
    file_id = create_uploaded_file(
        session_id=session_id, file_name=file_name, file_path=str(destination_path)
    )
    
    try:
        await run_in_threadpool(process_documents, file_id, destination_path)
        create_message(
            session_id=session_id,
            role="system",
            content=f"User uploaded a file: {file_name}",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
        
    return {
        "status": "success",
        "session_id": session_id,
    }
    
def delete_document(session_id:str, file_path: str):
    try:
        full_path = "./uploaded_files/" + file_path
        if os.path.isfile(full_path):
            os.remove(full_path)
            print(f"File '{full_path}' deleted successfully.")
            create_message(
                session_id = session_id,
                role="system",
                content=f"User removed file: {file_path} from database",
            )
            return "File deleted successfully."
        else:
            raise(HTTPException(status_code=500, detail=f"File '{file_path}' does not exist."))
    except PermissionError:
        raise(HTTPException(status_code=500, detail=f"Permission denied: Cannot delete '{file_path}'."))
    except OSError as e:
        raise(HTTPException(status_code=500, detail=f"Error deleting file '{file_path}': {e}"))