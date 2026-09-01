from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes_chat import router as chat_router
from api.routes_files import router as files_router
from api.routes_user import router as user_router

app = FastAPI(title="RAG Application")

origins = [
    "http://127.0.0.1:5500", 
    "http://localhost:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            
    allow_credentials=True,
    allow_methods=["*"],             
    allow_headers=["*"],            
)

app.include_router(user_router)
app.include_router(chat_router)
app.include_router(files_router)