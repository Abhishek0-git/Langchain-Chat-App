from pydantic import BaseModel


class ChatQuestion(BaseModel):
    question: str
    session_id: str
    user_id: str


class ChatSession(BaseModel):
    user: str
    session_id: str
    chat: list[dict] = []
