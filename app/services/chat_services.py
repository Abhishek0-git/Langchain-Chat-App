from langchain.messages import AIMessageChunk
from models.chat_history import load_chat_history, load_chat_history
from schemas.chat import ChatQuestion
from agents.ai_agent import agent_executor
from core.database import create_message, verify_session_ownership
from fastapi import HTTPException, status


def ask_llm(request: ChatQuestion):

    if not verify_session_ownership(request.session_id, request.user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Invalid session ownership.",
        )

    history = load_chat_history(request.session_id)

    async def stream_agent_response():
        inputs = {
            "messages": [
                ("system", f"Conversation History - \n{history}"),
                ("user", request.question),
            ]
        }
        create_message(
            session_id=request.session_id, role="user", content=request.question
        )

        full_answer = ""
        try:
            async for message, metadata in agent_executor.astream(
                inputs,
                stream_mode="messages",
            ):
                if isinstance(message, AIMessageChunk) and message.content:
                    if isinstance(message.content, str):
                        full_answer += message.content
                        yield message.content
        except Exception as e:
            yield f"\n[Agent Error: {str(e)}]"
            full_answer += f"\n[Agent Error: {str(e)}]"
        create_message(
            session_id=request.session_id, role="assistant", content=full_answer
        )

    return stream_agent_response()
