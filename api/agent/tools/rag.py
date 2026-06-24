import os
from langchain_core.tools import tool
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from langchain_core.documents import Document
from config import settings

PERSIST_DIR = os.path.join(os.path.dirname(__file__), "../../../knowledge_base")

_vectorstore: Chroma | None = None


def _get_vectorstore() -> Chroma:
    global _vectorstore
    if _vectorstore is None:
        embeddings = OllamaEmbeddings(
            model=settings.OLLAMA_EMBED_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
        )
        _vectorstore = Chroma(
            collection_name="EDITH_knowledge",
            embedding_function=embeddings,
            persist_directory=PERSIST_DIR,
        )
    return _vectorstore


@tool
def search_knowledge(query: str) -> str:
    """
    Search personal knowledge base — notes, documents, PDFs — using semantic search.
    Use this when the user asks about something from their notes or documents.
    """
    try:
        vs = _get_vectorstore()
        docs = vs.similarity_search(query, k=4)
        if not docs:
            return "Nothing found in your knowledge base for that query."
        results = []
        for doc in docs:
            source = doc.metadata.get("source", "unknown")
            results.append(f"[{source}]\n{doc.page_content[:400]}")
        return "\n\n---\n\n".join(results)
    except Exception as e:
        return f"Knowledge base search failed: {e}"


@tool
def add_note(title: str, content: str) -> str:
    """
    Save a note to the personal knowledge base so it can be searched later.
    title: short label for this note
    content: the full text of the note
    """
    try:
        vs = _get_vectorstore()
        doc = Document(page_content=content, metadata={"source": title})
        vs.add_documents([doc])
        return f"Note '{title}' saved to knowledge base."
    except Exception as e:
        return f"Failed to save note: {e}"
