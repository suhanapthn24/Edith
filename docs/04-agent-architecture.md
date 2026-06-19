# APEX — Agent Architecture (Ollama-first)
### v1.1 · June 2026

## Philosophy: Local-first, Cloud-when-needed

| Task Type | Model | Cost |
|---|---|---|
| Routing, classification, short answers | `llama3.2:3b` (Ollama) | Free |
| General agent work, explanations, lessons | `llama3.1:8b` (Ollama) | Free |
| Code explanation, DSA solutions | `codellama:7b` (Ollama) | Free |
| Embeddings (Knowledge Vault RAG) | `nomic-embed-text` (Ollama) | Free |
| Long-context PDF processing (papers) | `claude-sonnet-4-6` | ~$0.003/paper |
| Deep skill gap analysis, complex curriculum | `claude-sonnet-4-6` | On-demand |

**Target: 80%+ of agent calls run locally via Ollama. Claude is invoked only for tasks that genuinely require 200K context or superior reasoning.**

---

## Ollama Setup

```bash
# Install Ollama (Windows/Mac/Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull required models
ollama pull llama3.2:3b        # fast orchestrator / routing
ollama pull llama3.1:8b        # general agent work
ollama pull codellama:7b       # DSA / code explanations
ollama pull nomic-embed-text   # embeddings (768-dim)
ollama pull mistral:7b         # optional: alternative general model

# Ollama runs at http://localhost:11434
```

---

## Agent Definitions

### AgentState (LangGraph TypedDict)

```python
from typing import TypedDict, Annotated, Literal
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    user_id: str
    user_context: dict          # goals, preferences, timezone
    module_data: dict           # DB data relevant to the request
    retrieved_knowledge: list   # RAG results from pgvector
    messages: list[BaseMessage]
    output: dict
    next: str                   # routing decision
    model_preference: Literal['ollama', 'claude', 'auto']
```

---

### Orchestrator Agent
- **Model:** `llama3.2:3b` (fast, low-latency routing)
- **Role:** Receives user intent → classifies → routes to specialist(s) → synthesizes
- **LangGraph pattern:** Supervisor
- **Tools:** `classify_intent`, `route_to_agents`, `synthesize_responses`

```python
ORCHESTRATOR_SYSTEM = """
You are APEX, a personal AI chief of staff. Your job is to:
1. Understand what the user is asking
2. Identify which specialist agents are needed
3. Coordinate their responses into a unified answer

Available agents: calendar, language, research, career, dsa, skills, knowledge

Always be concise and actionable. The user is a CS student focused on AI, 
language learning, research, and career development.
"""
```

---

### Calendar Agent
- **Model:** `llama3.1:8b` (Ollama)
- **Role:** Schedule analysis and smart scheduling
- **Tools:** `get_events(date_range)`, `find_free_blocks(min_duration_mins)`, `suggest_schedule(activity, duration)`, `create_event(title, start, end)`
- **External:** Google Calendar API, Microsoft Graph API

```python
CALENDAR_SYSTEM = """
You are a scheduling assistant. You have access to the user's calendar events
and free blocks. Help them use their time purposefully.
Prefer scheduling deep work in morning slots, language practice in evenings.
"""
```

---

### Language Agent
- **Model:** `llama3.1:8b` (Ollama) for lessons and conversation
- **Upgrade to Claude for:** complex grammar curricula, detailed etymology
- **Role:** Multilingual tutor and SM-2 curriculum manager
- **Tools:** `get_vocabulary_due(lang)`, `update_sm2(item_id, grade)`, `generate_lesson(lang, level, topic)`, `run_conversation(lang, topic)`

```python
LANGUAGE_SYSTEM = """
You are a multilingual tutor. The user is learning French (A2), Arabic (A1), 
and Mandarin (A1). Adapt lesson difficulty to their current level.
For vocabulary review, use the SM-2 grades: 0=blackout, 1=wrong, 2=hard, 
3=correct, 4=easy, 5=perfect. Generate contextual example sentences.
"""
```

---

### DSA Agent (NeetCode 150)
- **Model:** `codellama:7b` (Ollama) — specialized for code
- **Upgrade to Claude for:** complex DP explanations, advanced graph algorithms
- **Role:** NeetCode 150 coach and problem recommender
- **Tools:** `get_neetcode_progress()`, `get_next_problem(category)`, `get_revision_due()`, `explain_approach(problem_id)`, `analyze_weakness()`

```python
DSA_SYSTEM = """
You are a DSA coach specializing in the NeetCode 150 roadmap.
Help the user master LeetCode problems in NeetCode order.
When explaining solutions, always cover: 
1. Intuition / pattern recognition
2. Step-by-step approach
3. Time and space complexity
4. Common variations and edge cases
The user prefers Python solutions.
"""
```

**NeetCode 150 Progress Tracking:**
- Each problem has `is_neetcode_150=True` and `neetcode_order` (1-150)
- Agent recommends: next unsolved in current category → or revision due → or jump to next category
- Mastery: category is "mastered" when all problems solved at least once + SM-2 healthy

---

### Research Agent
- **Model:** `claude-sonnet-4-6` (required — PDF context is 50K+ tokens)
- **Fallback for simple Q&A:** `llama3.1:8b` on already-summarized papers
- **Role:** Literature review assistant
- **Tools:** `search_arxiv(query)`, `search_semantic_scholar(query)`, `summarize_paper(paper_id)`, `extract_methodology(paper_id)`, `find_related(paper_id)`

```python
RESEARCH_SYSTEM = """
You are an AI research assistant. Help the user understand papers in AI, ML, 
Graph ML, and related areas. When summarizing:
- Key contributions (bullet points)
- Methodology (clear prose)
- Datasets used
- Key equations (LaTeX)
- How they could implement or extend this work
"""
```

---

### Career Agent
- **Model:** `llama3.1:8b` (Ollama) for tracking and basic analysis
- **Upgrade to Claude for:** deep skill gap analysis, resume tailoring
- **Role:** Job search strategist
- **Tools:** `get_applications()`, `analyze_resume(resume_id)`, `score_fit(job_desc)`, `find_skill_gaps(target_roles)`, `prep_interview(application_id)`

---

### Skills Agent
- **Model:** `llama3.1:8b` (Ollama)
- **Role:** Learning path manager for certifications and courses
- **Tools:** `get_resources(status)`, `suggest_next_resource(goal)`, `generate_study_plan(resource_id)`, `update_progress(resource_id, pct)`

```python
SKILLS_SYSTEM = """
You are a learning path advisor. Help the user build skills strategically 
toward their goals: AI/ML expertise, international internships, Master's program.
Prioritize certifications and courses with highest ROI for their target roles.
Current focus areas: AI/ML, Cloud (Azure), Backend (FastAPI), System Design.
"""
```

---

### Knowledge Agent
- **Model:** `nomic-embed-text` (Ollama) for embedding + `llama3.1:8b` for generation
- **Role:** RAG-powered knowledge retrieval
- **Tools:** `embed_query(text)`, `vector_search(embedding, top_k)`, `answer_from_knowledge(question, chunks)`

```python
KNOWLEDGE_SYSTEM = """
You are a knowledge retrieval assistant. Answer the user's questions using 
ONLY the provided context from their personal knowledge vault.
If the answer is not in the context, say so clearly.
Always cite which note/article the information came from.
"""
```

---

## LangGraph Graph Definition

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver

def build_apex_graph(checkpointer):
    graph = StateGraph(AgentState)

    # Add agent nodes
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("calendar", calendar_agent_node)
    graph.add_node("language", language_agent_node)
    graph.add_node("research", research_agent_node)
    graph.add_node("career", career_agent_node)
    graph.add_node("dsa", dsa_agent_node)
    graph.add_node("skills", skills_agent_node)
    graph.add_node("knowledge", knowledge_agent_node)
    graph.add_node("synthesizer", synthesizer_node)

    # Orchestrator routes conditionally
    graph.add_conditional_edges(
        "orchestrator",
        route_to_agents,
        {
            "calendar": "calendar",
            "language": "language",
            "research": "research",
            "career": "career",
            "dsa": "dsa",
            "skills": "skills",
            "knowledge": "knowledge",
            "synthesizer": "synthesizer",  # direct answer
        }
    )

    # All specialist agents → synthesizer
    for agent in ["calendar","language","research","career","dsa","skills","knowledge"]:
        graph.add_edge(agent, "synthesizer")

    graph.add_edge("synthesizer", END)
    graph.set_entry_point("orchestrator")

    # Persist conversation state in PostgreSQL
    return graph.compile(checkpointer=checkpointer)
```

---

## Model Selection Logic

```python
def select_model(task_type: str, content_length: int) -> str:
    """Decide which model to use based on task requirements."""
    
    # Always use Claude for:
    if task_type == "paper_summarization":        return "claude-sonnet-4-6"
    if task_type == "deep_skill_gap_analysis":    return "claude-sonnet-4-6"
    if content_length > 50_000:                   return "claude-sonnet-4-6"
    
    # Use CodeLlama for:
    if task_type in ["dsa_explain", "code_review", "solution_walkthrough"]:
        return "codellama:7b"
    
    # Use fast model for:
    if task_type in ["routing", "classification", "short_answer"]:
        return "llama3.2:3b"
    
    # Default: general Ollama model
    return "llama3.1:8b"
```

---

## Fine-tuning Plan (Future)

Once Ollama is running and you have accumulated data:

1. **Collect training data:** Save all good AI conversations to a JSONL file
2. **Fine-tune llama3.1:8b** using Ollama's Modelfile system for:
   - Language lessons in your specific learning style
   - DSA explanations that match your understanding level
   - Briefings in your preferred format
3. **Use Unsloth** (free, fast fine-tuning on consumer GPU) for LoRA fine-tuning
4. **Load custom model** back into Ollama as `apex-tuned:latest`

```bash
# Ollama Modelfile for personalized model
FROM llama3.1:8b
SYSTEM """You are APEX, personalized AI for [your name]. 
[Personalization details here after fine-tuning]"""
```
