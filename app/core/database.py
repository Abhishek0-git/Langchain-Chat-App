import psycopg2
from services.vector_store import embedding_model

connection_string = "dbname=rag_project_database user=postgres password=1234567"


def create_user(email: str, username: str, password:str) -> int:
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    cur.execute(
        "INSERT INTO users (email, username, password_hash) VALUES (%s, %s, %s) RETURNING id;",
        (email, username, password),
    )
    new_user_id = cur.fetchone()[0]
    connection.commit()
    cur.close()
    connection.close()
    return new_user_id


def verify_user_from_database(username: str, password: str):
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    cur.execute(
        "SELECT id FROM users WHERE username = %s AND password_hash = %s;", (username, password),
    )
    result = cur.fetchone()
    cur.close()
    connection.close()
    print(result)
    if result is not None:
        return result[0]
    return False
    
    
def create_session(session_id: str, user_id: int, title: str = "New Chat"):
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    cur.execute(
        "INSERT INTO sessions (id, user_id, title) VALUES (%s, %s, %s);",
        (session_id, user_id, title)
    )
    connection.commit()
    cur.close()
    connection.close()


def create_message(session_id: str, role: str, content: str):
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    cur.execute(
        "INSERT INTO messages (session_id, role, content) VALUES (%s, %s, %s);",
        (session_id, role, content),
    )
    connection.commit()
    cur.close()
    connection.close()


def create_uploaded_file(session_id: str, file_name: str, file_path: str) -> int:
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    cur.execute(
        "INSERT INTO uploaded_files (session_id, file_name, file_path) VALUES (%s, %s, %s) RETURNING id;",
        (session_id, file_name, file_path),
    )
    new_file_id = cur.fetchone()[0]
    connection.commit()
    cur.close()
    connection.close()
    return new_file_id


def create_document_chunk(
    file_id: int, chunk_content: str, embedding: list, chunk_number: int = 1
):
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    str_embedding = "[" + ",".join(map(str, embedding)) + "]"

    cur.execute(
        "INSERT INTO document_chunks (file_id, chunk_content, embedding, chunk_number) VALUES (%s, %s, %s, %s);",
        (file_id, chunk_content, str_embedding, chunk_number),
    )
    connection.commit()
    cur.close()
    connection.close()


def similarity_search(query: str) -> list[tuple]:
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    query_embedding = embedding_model.embed_query(query)
    cur.execute(
        "SELECT chunk_content FROM document_chunks ORDER BY embedding <->%s::vector LIMIT 5",
        (query_embedding,),
    )
    result = cur.fetchall()
    cur.close()
    connection.close()
    return result


def get_chat_history(session_id: str):
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    cur.execute(
        "SELECT role, content FROM messages WHERE session_id = %s ORDER BY created_at ASC;",
        (session_id,),
    )
    db_rows = cur.fetchall()
    cur.close()
    connection.close()
    return db_rows


def get_user_sessions(user_id: int):
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    cur.execute(
        "SELECT id, title, created_at FROM sessions WHERE user_id = %s ORDER BY created_at DESC;",
        (user_id,),
    )
    sessions = cur.fetchall()
    cur.close()
    connection.close()
    return sessions


def verify_session_ownership(session_id: str, user_id: int) -> bool:
    """
    Checks if a session belongs to the given user.
    Returns True if it matches, False otherwise.
    """
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()

    cur.execute(
        "SELECT 1 FROM sessions WHERE id = %s AND user_id = %s;", (session_id, user_id),
    )
    result = cur.fetchone()

    cur.close()
    connection.close()
    return result is not None

def get_documents(session_id: str) -> list:
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    
    cur.execute(
        "SELECT file_name FROM uploaded_files WHERE session_id = %s;", (session_id,),
    )

    result = cur.fetchall()
    cur.close()
    connection.close()
    clean_response = [doc[0][37:] for doc in result] if result else []
    return clean_response


def get_document_id(session_id: str) -> list:
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    
    cur.execute(
        "SELECT id FROM uploaded_files WHERE session_id = %s;", (session_id,),
    )

    result = cur.fetchall()
    cur.close()
    connection.close()
    clean_response = [doc for doc in result] if result else []
    return clean_response

def delete_document_from_database(file_name:str):
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    cur.execute(
        "DELETE FROM uploaded_files WHERE file_name = %s RETURNING *;", (file_name,)
    )
    result = cur.fetchone()
    connection.commit()
    cur.close()
    connection.close()
    return result

def delete_session_from_database(session_id:str) -> list[tuple]:
    connection = psycopg2.connect(connection_string)
    cur = connection.cursor()
    cur.execute(
        "DELETE from sessions WHERE id = %s RETURNING *;", (session_id,)
    )
    result = cur.fetchall()
    connection.commit()
    cur.close()
    connection.close()
    return result if result else None

