from schemas.file import SessionFile
from core.database import (
    get_chat_history,
    create_session,
    create_message,
    get_user_sessions,
)


def load_chat_history(session_id: str) -> list[dict]:
    db_rows = get_chat_history(session_id)
    structured_history = []

    i = 0
    while i < len(db_rows):
        role, content = db_rows[i][0].lower(), db_rows[i][1]

        if role == "system":
            structured_history.append({"role": "system", "content": content})
            i += 1
        elif role == "user":
            # Peek ahead to check if there is a matching assistant response
            if i + 1 < len(db_rows) and db_rows[i + 1][0].lower() == "assistant":
                assistant_content = db_rows[i + 1][1]
                structured_history.append(
                    {"role": "user", "content": content, "assistant": assistant_content}
                )
                i += 2
            else:
                structured_history.append(
                    {"role": "user", "content": content, "assistant": ""}
                )
                i += 1
        else:
            structured_history.append({"role": "assistant", "content": content})
            i += 1

    return structured_history


def add_new_session(session_id: str, user_id: int, title: str = "New Chat"):
    create_session(session_id=session_id, user_id=user_id, title=title)
    create_message(session_id=session_id, role="system", content="Session initialized.")


def fetch_all_user_sessions(user_id: int) -> list[dict]:
    rows = get_user_sessions(user_id)
    return [
        {"session_id": row[0], "title": row[1], "created_at": str(row[2])}
        for row in rows
    ]


def add_system_upload_message(session_file: SessionFile):
    session_id = session_file.session_id
    filename = session_file.file.filename if session_file.file else "Unknown File"

    create_message(
        session_id=session_id,
        role="system",
        content=f"User uploaded a file: {filename}",
    )

def get_session_conversations(session_id: str) -> list[dict]:
    db_rows = get_chat_history(session_id)
    formatted_messages = []
    
    for row in db_rows:
        role, content = row[0], row[1]
        # Standardizing roles to lowercase so the frontend has a predictable schema
        if role != "system":
            formatted_messages.append({
                "role": role.lower(), 
                "content": content
            })
        
    return formatted_messages