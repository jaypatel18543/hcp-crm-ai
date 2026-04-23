from fastapi import APIRouter
from models.schemas import AgentChatRequest, AgentChatResponse
from agents.hcp_agent import run_agent

router = APIRouter()


@router.post("/chat", response_model=AgentChatResponse)
def chat_with_agent(payload: AgentChatRequest):
    result = run_agent(
        message=payload.message,
        session_id=payload.session_id or "default",
        current_form_data=payload.current_form_data or {},
    )
    return AgentChatResponse(**result)
