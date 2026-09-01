from langchain_ollama import OllamaEmbeddings

# persist_directory = "db/chroma_db"

# --- if you want the chunks in memory(RAM) ---
# embedding_list = []

embedding_model = OllamaEmbeddings(model="mxbai-embed-large:335m")

# chroma_vector_store = Chroma(
#     embedding_function=embedding_model,
#     persist_directory=persist_directory,
#     collection_metadata={"hnsw:space": "cosine"},
# )
