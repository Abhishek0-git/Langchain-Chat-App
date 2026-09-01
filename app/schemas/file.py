from pydantic import BaseModel
from fastapi import UploadFile, File


class SessionFile(BaseModel):
    session_id: str
    file: UploadFile = File()
