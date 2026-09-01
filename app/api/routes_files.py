from fastapi import APIRouter, Form, UploadFile, File
from services.file_services import upload_documents, delete_document
from core.database import get_documents, delete_document_from_database

router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload")
async def upload(session_id: str = Form(...), file: UploadFile = File(...)):
    try:
        response = await upload_documents(session_id, file)
        return response
    except Exception as e:
        print(e)

@router.delete("/delete")
async def delete_documents(session_id:str, file_name: str):
    complete_name = session_id + "_" + file_name
    print(complete_name)
    result = delete_document_from_database(complete_name)
    delete_document(session_id, complete_name)
    return {"status":"success", "content":result}

@router.get("/{session_id}")
async def get_document(session_id: str):
    response = get_documents(session_id)
    return {"status": "success", "sessions": response}