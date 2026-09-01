from langchain_ollama import ChatOllama
from langchain.agents import create_agent
from agents.tools import search_docs, search_tool, time, calc

# chat_model = ChatOllama(
#     base_url="https://scrambled-glorious-pancreas.ngrok-free.dev",
#     model="qwen3.5:9b",
#     temperature=0.7,
# )
chat_model = ChatOllama(model="llama3.2:3b", temperature=0.7)
agent_system_prompt = (
    "You are a helpful AI assistant equipped with specific tools to answer questions.\n"
    "Whenever a user asks a question that requires real-time data, calculations, "
    "or document searching, you MUST select and call the appropriate tool.\n"
    "Do not make up facts. Current tools available: search_docs, time, calc, search_tool."
)
tools = [search_docs, time, calc, search_tool]

agent_executor = create_agent(
    model=chat_model,
    tools=tools,
    system_prompt=agent_system_prompt,
)
