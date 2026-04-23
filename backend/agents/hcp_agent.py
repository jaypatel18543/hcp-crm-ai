"""
LangGraph AI Agent for HCP CRM
Tools:
1. log_interaction      - Capture and save a new HCP interaction
2. edit_interaction     - Modify an existing logged interaction
3. summarize_topics     - Use LLM to summarize/structure discussion topics
4. suggest_followups    - AI-driven follow-up action recommendations
5. analyze_sentiment    - Infer HCP sentiment from conversation description
"""

import os
import json
import re
from typing import TypedDict, Annotated, List, Optional
from datetime import datetime

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langgraph.graph.message import add_messages

from db.database import SessionLocal, Interaction, init_db

init_db()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "your_groq_api_key_here")

llm = ChatGroq(
    model="llama-3.1-8b-instant",
    api_key=GROQ_API_KEY,
    temperature=0.2,
)

llm_large = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=GROQ_API_KEY,
    temperature=0.3,
)


# ─── Tool 1: Log Interaction ────────────────────────────────────────────────
@tool
def log_interaction(
    hcp_name: str,
    interaction_type: str = "Meeting",
    topics_discussed: str = "",
    sentiment: str = "neutral",
    outcomes: str = "",
    follow_up_actions: str = "",
    attendees: str = "",
    materials_shared: str = "",
    samples_distributed: str = "",
) -> dict:
    """
    Log a new HCP interaction to the database.
    Use this tool when the user provides details about a meeting or call with an HCP.
    Extracts and saves all relevant interaction data.

    Args:
        hcp_name: Full name of the Healthcare Professional
        interaction_type: Type of interaction (Meeting, Call, Email, Conference, Demo)
        topics_discussed: Key discussion points from the interaction
        sentiment: Observed HCP sentiment (positive, neutral, negative)
        outcomes: Key outcomes or agreements reached
        follow_up_actions: Next steps or follow-up tasks
        attendees: Names of people who attended
        materials_shared: Brochures, PDFs or materials shared
        samples_distributed: Product samples given to the HCP

    Returns:
        dict with saved interaction details and ID
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        interaction = Interaction(
            hcp_name=hcp_name,
            interaction_type=interaction_type,
            date=now.strftime("%Y-%m-%d"),
            time=now.strftime("%H:%M"),
            topics_discussed=topics_discussed,
            sentiment=sentiment,
            outcomes=outcomes,
            follow_up_actions=follow_up_actions,
            attendees=attendees,
            materials_shared=materials_shared,
            samples_distributed=samples_distributed,
        )
        db.add(interaction)
        db.commit()
        db.refresh(interaction)
        return {
            "success": True,
            "interaction_id": interaction.id,
            "hcp_name": interaction.hcp_name,
            "message": f"Interaction with {hcp_name} logged successfully (ID: {interaction.id})",
        }
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()


# ─── Tool 2: Edit Interaction ────────────────────────────────────────────────
@tool
def edit_interaction(
    interaction_id: int,
    hcp_name: Optional[str] = None,
    interaction_type: Optional[str] = None,
    topics_discussed: Optional[str] = None,
    sentiment: Optional[str] = None,
    outcomes: Optional[str] = None,
    follow_up_actions: Optional[str] = None,
    attendees: Optional[str] = None,
    materials_shared: Optional[str] = None,
    samples_distributed: Optional[str] = None,
) -> dict:
    """
    Edit/update an existing HCP interaction record by its ID.
    Use this when a user wants to correct or add information to a previously logged interaction.
    Only updates fields that are explicitly provided.

    Args:
        interaction_id: The ID of the interaction to edit
        hcp_name: Updated HCP name (optional)
        interaction_type: Updated interaction type (optional)
        topics_discussed: Updated discussion topics (optional)
        sentiment: Updated sentiment value (optional)
        outcomes: Updated outcomes (optional)
        follow_up_actions: Updated follow-up actions (optional)
        attendees: Updated attendees list (optional)
        materials_shared: Updated materials info (optional)
        samples_distributed: Updated samples info (optional)

    Returns:
        dict confirming the update with changed fields
    """
    db = SessionLocal()
    try:
        interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not interaction:
            return {"success": False, "error": f"Interaction ID {interaction_id} not found"}

        updates = {}
        if hcp_name is not None:
            interaction.hcp_name = hcp_name
            updates["hcp_name"] = hcp_name
        if interaction_type is not None:
            interaction.interaction_type = interaction_type
            updates["interaction_type"] = interaction_type
        if topics_discussed is not None:
            interaction.topics_discussed = topics_discussed
            updates["topics_discussed"] = topics_discussed
        if sentiment is not None:
            interaction.sentiment = sentiment
            updates["sentiment"] = sentiment
        if outcomes is not None:
            interaction.outcomes = outcomes
            updates["outcomes"] = outcomes
        if follow_up_actions is not None:
            interaction.follow_up_actions = follow_up_actions
            updates["follow_up_actions"] = follow_up_actions
        if attendees is not None:
            interaction.attendees = attendees
            updates["attendees"] = attendees
        if materials_shared is not None:
            interaction.materials_shared = materials_shared
            updates["materials_shared"] = materials_shared
        if samples_distributed is not None:
            interaction.samples_distributed = samples_distributed
            updates["samples_distributed"] = samples_distributed

        interaction.updated_at = datetime.utcnow()
        db.commit()
        return {
            "success": True,
            "interaction_id": interaction_id,
            "updated_fields": updates,
            "message": f"Interaction {interaction_id} updated successfully",
        }
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()


# ─── Tool 3: Summarize Topics ────────────────────────────────────────────────
@tool
def summarize_topics(raw_notes: str) -> dict:
    """
    Use the LLM to intelligently summarize and structure raw meeting notes or voice transcripts
    into clean, professional clinical discussion points suitable for a CRM record.
    Extracts key clinical topics, products mentioned, and physician concerns.

    Args:
        raw_notes: Raw, unstructured meeting notes or transcript text

    Returns:
        dict with structured summary, key topics list, and products mentioned
    """
    prompt = f"""You are a medical field representative CRM assistant. 
Analyze these raw meeting notes and extract structured information:

RAW NOTES:
{raw_notes}

Return a JSON object with:
- "summary": A 2-3 sentence professional summary
- "key_topics": List of 3-5 bullet points of main discussion items
- "products_mentioned": List of any products/drugs discussed
- "hcp_concerns": List of any concerns or questions raised by the HCP
- "clinical_data_discussed": Any clinical trial data or efficacy points mentioned

Respond ONLY with valid JSON, no markdown."""

    response = llm_large.invoke([HumanMessage(content=prompt)])
    try:
        result = json.loads(response.content)
    except Exception:
        result = {
            "summary": response.content,
            "key_topics": [],
            "products_mentioned": [],
            "hcp_concerns": [],
            "clinical_data_discussed": [],
        }
    return {"success": True, "structured_data": result}


# ─── Tool 4: Suggest Follow-ups ─────────────────────────────────────────────
@tool
def suggest_followups(
    hcp_name: str,
    topics_discussed: str,
    sentiment: str = "neutral",
    outcomes: str = "",
) -> dict:
    """
    Generate AI-powered, context-aware follow-up action recommendations for a field rep
    based on the HCP interaction details. Suggests next best actions to advance the relationship.

    Args:
        hcp_name: Name of the HCP
        topics_discussed: What was discussed in the meeting
        sentiment: HCP sentiment (positive/neutral/negative)
        outcomes: What was agreed upon in the meeting

    Returns:
        dict with prioritized follow-up suggestions
    """
    prompt = f"""You are an expert pharmaceutical field sales coach.
Based on this HCP interaction, suggest 3-5 specific follow-up actions:

HCP: {hcp_name}
Topics: {topics_discussed}
Sentiment: {sentiment}
Outcomes: {outcomes}

Return a JSON object with:
- "immediate_actions": List of actions to do within 24 hours
- "weekly_actions": List of actions for the next week
- "materials_to_send": Specific materials or resources to share
- "next_meeting_agenda": Suggested topics for the next visit
- "relationship_tip": One personalized relationship-building suggestion

Respond ONLY with valid JSON, no markdown."""

    response = llm.invoke([HumanMessage(content=prompt)])
    try:
        result = json.loads(response.content)
    except Exception:
        result = {
            "immediate_actions": ["Schedule follow-up meeting in 2 weeks"],
            "weekly_actions": ["Send product literature"],
            "materials_to_send": [],
            "next_meeting_agenda": [],
            "relationship_tip": "Personalize your next interaction based on their concerns.",
        }
    return {"success": True, "suggestions": result}


# ─── Tool 5: Analyze Sentiment ───────────────────────────────────────────────
@tool
def analyze_sentiment(interaction_description: str, hcp_name: str = "") -> dict:
    """
    Analyze the HCP's sentiment from a natural language description of the interaction.
    Uses LLM reasoning to infer emotional tone, engagement level, and receptiveness.
    Detects positive interest, objections, neutral engagement, or negative reactions.

    Args:
        interaction_description: Description of how the HCP behaved or responded
        hcp_name: Name of the HCP (for context)

    Returns:
        dict with sentiment classification, confidence, and reasoning
    """
    prompt = f"""You are a pharmaceutical sales expert analyzing an HCP interaction.
Determine the HCP's sentiment from this description:

HCP: {hcp_name}
Description: {interaction_description}

Return a JSON object with:
- "sentiment": One of "positive", "neutral", or "negative"
- "confidence": Confidence level 0-100
- "engagement_level": "high", "medium", or "low"
- "receptiveness": "open", "cautious", or "resistant"
- "key_signals": List of 2-3 specific signals that informed this assessment
- "reasoning": One sentence explanation

Respond ONLY with valid JSON, no markdown."""

    response = llm.invoke([HumanMessage(content=prompt)])
    try:
        result = json.loads(response.content)
    except Exception:
        result = {
            "sentiment": "neutral",
            "confidence": 50,
            "engagement_level": "medium",
            "receptiveness": "cautious",
            "key_signals": ["Unable to parse response"],
            "reasoning": response.content[:200],
        }
    return {"success": True, "analysis": result}


# ─── LangGraph State ─────────────────────────────────────────────────────────
class AgentState(TypedDict):
    messages: Annotated[List, add_messages]
    session_id: str
    current_form_data: dict


SYSTEM_PROMPT = """You are an AI assistant embedded in a pharmaceutical CRM system, helping field medical representatives log and manage their HCP (Healthcare Professional) interactions.

You have access to these tools:
1. **log_interaction** - Save a new HCP meeting/call to the database
2. **edit_interaction** - Update an existing interaction record  
3. **summarize_topics** - Intelligently structure raw notes into professional CRM entries
4. **suggest_followups** - Generate smart follow-up action recommendations
5. **analyze_sentiment** - Detect HCP receptiveness from interaction descriptions

When a user describes an interaction, proactively:
- Extract key details (HCP name, meeting type, topics, sentiment)
- Offer to log it immediately
- Suggest relevant follow-ups
- Analyze sentiment if unclear

Always be concise, professional, and focused on helping reps capture accurate interaction data efficiently. 
If the user provides enough info to log an interaction, call log_interaction directly without asking for confirmation."""

tools = [log_interaction, edit_interaction, summarize_topics, suggest_followups, analyze_sentiment]
llm_with_tools = llm_large.bind_tools(tools)


def agent_node(state: AgentState):
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


def should_continue(state: AgentState):
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return END


tool_node = ToolNode(tools)

graph_builder = StateGraph(AgentState)
graph_builder.add_node("agent", agent_node)
graph_builder.add_node("tools", tool_node)
graph_builder.set_entry_point("agent")
graph_builder.add_conditional_edges("agent", should_continue)
graph_builder.add_edge("tools", "agent")

agent_graph = graph_builder.compile()


def run_agent(message: str, session_id: str = "default", current_form_data: dict = {}) -> dict:
    context = ""
    if current_form_data:
        context = f"\n\n[Current form data: {json.dumps(current_form_data)}]"

    result = agent_graph.invoke(
        {
            "messages": [HumanMessage(content=message + context)],
            "session_id": session_id,
            "current_form_data": current_form_data,
        }
    )

    last_message = result["messages"][-1]
    reply = last_message.content if hasattr(last_message, "content") else str(last_message)

    # Parse out tool results for structured response
    extracted_data = {}
    interaction_id = None
    follow_up_suggestions = []
    action = None

    for msg in result["messages"]:
        if isinstance(msg, ToolMessage):
            try:
                tool_result = json.loads(msg.content)
                if "interaction_id" in tool_result:
                    interaction_id = tool_result["interaction_id"]
                    action = "logged"
                if "suggestions" in tool_result:
                    s = tool_result["suggestions"]
                    follow_up_suggestions = s.get("immediate_actions", []) + s.get("weekly_actions", [])
                    action = "suggested_followups"
                if "analysis" in tool_result:
                    extracted_data["sentiment_analysis"] = tool_result["analysis"]
                    action = "analyzed_sentiment"
                if "structured_data" in tool_result:
                    extracted_data["structured_summary"] = tool_result["structured_data"]
                    action = "summarized"
                if "updated_fields" in tool_result:
                    action = "edited"
            except Exception:
                pass

    return {
        "reply": reply,
        "action": action,
        "extracted_data": extracted_data,
        "follow_up_suggestions": follow_up_suggestions[:5],
        "interaction_id": interaction_id,
    }