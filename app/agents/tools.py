from langchain.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from datetime import datetime
# from services.file_services import chroma_vector_store
from core.database import similarity_search
search_tool = DuckDuckGoSearchRun()

@tool(
    "search_uploaded_files",
    description="MUST be used whenever the user asks a question about their documents,files, or specific uploaded knowledge base. Use this tool to gather factual evidence BEFORE attempting to answer. Input must be a clear query string.",
)
def search_docs(question: str) -> list[tuple]:

    # retriever = chroma_vector_store.as_retriever(
    #     search_type="similarity_score_threshold",
    #     search_kwargs={"k": 5, "score_threshold": 0.3},
    # )
    # relevent_docs = retriever.invoke(question)

    # return "\n\n".join(
    #     [
    #         f"Content: {d.page_content} (Source: {d.metadata.get('source')})"
    #         for d in relevent_docs
    #     ]
    # )
    
    return similarity_search(question)
    
    


@tool(
    "calculator",
    description="Performs arithmetic calculations. Use this for any math problems.",
)
def calc(expression: str) -> str:
    """Evaluate mathematical expressions."""
    return str(eval(expression))


@tool(
    "datetime",
    description="Gives current date and time. Use this only to get the cuurent date and time",
)
def time():
    return datetime.now()
