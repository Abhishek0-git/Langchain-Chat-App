from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from schemas.chat import ChatQuestion
from services.chat_services import ask_llm
from models.chat_history import (
    fetch_all_user_sessions,
    add_new_session,
    get_session_conversations,
)
from core.database import (
    verify_session_ownership,
    delete_session_from_database,
    create_user,
    verify_user_from_database,
    get_documents,
)
from services.file_services import delete_document

router = APIRouter(prefix="/user/session", tags=["Chat & Sessions"])


@router.post("/new")
async def create_new_chat_session(
    session_id: str, user_id: int, title: str = "New Chat"
):
    try:
        add_new_session(session_id=session_id, user_id=user_id, title=title)
        return {
            "status": "success",
            "message": f"Session {session_id} successfully initialized.",
            "session_id": session_id,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create session: {str(e)}"
        )


@router.get("/{session_id}")
async def get_sessions(user_id: int):
    try:
        sessions = fetch_all_user_sessions(user_id)
        return {"status": "success", "sessions": sessions}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Could not fetch sessions: {str(e)}"
        )


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    try:
        documents = get_documents(session_id)
        if documents:
            for i in documents:
                complete_name = session_id + "_" + i
                delete_document(session_id, complete_name)

        result = delete_session_from_database(session_id)

        return {"status": "success", "content": result if result else result[0][2]}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Unable to delete session: {str(e)}"
        )


@router.get("/{session_id}/messages")
async def get_session_messages(session_id: str, user_id: int):
    try:
        is_owner = verify_session_ownership(session_id, user_id)

        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to view this session.",
            )

        messages = get_session_conversations(session_id)
        return {"status": "success", "session_id": session_id, "messages": messages}

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve conversation history: {str(e)}"
        )


@router.post("/{session_id}/chat")
async def stream_chat(request: ChatQuestion):
    try:
        generator = ask_llm(request)
        return StreamingResponse(generator, media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Streaming failed: {str(e)}")
