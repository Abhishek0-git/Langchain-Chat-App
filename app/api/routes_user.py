from fastapi import APIRouter, HTTPException
from core.database import create_user, verify_user_from_database

router = APIRouter(prefix="/users", tags=["User"])

@router.post("/new")
async def create_new_user(email:str, username:str, password:str):
    try:
        result = create_user(email, username, password)
        return {"status": "success", "content" : result}
    except Exception as e:
        print(e)
        raise(HTTPException(status_code=500, detail=f"Failed to create user: {e}"))

@router.get("/{user_id}")
async def verify_user(username:str, password:str):
    try:
        result = verify_user_from_database(username, password)
        return {"status": "success", "content" : result}
    except Exception as e:
        raise(HTTPException(status_code=500, detail=f"Failed to verify user: {e}"))