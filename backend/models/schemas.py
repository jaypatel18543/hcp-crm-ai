from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class InteractionCreate(BaseModel):
    hcp_name: str
    interaction_type: str = "Meeting"
    date: Optional[str] = None
    time: Optional[str] = None
    attendees: Optional[str] = ""
    topics_discussed: Optional[str] = ""
    materials_shared: Optional[str] = ""
    samples_distributed: Optional[str] = ""
    sentiment: Optional[str] = "neutral"
    outcomes: Optional[str] = ""
    follow_up_actions: Optional[str] = ""


class InteractionUpdate(BaseModel):
    hcp_name: Optional[str] = None
    interaction_type: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[str] = None
    samples_distributed: Optional[str] = None
    sentiment: Optional[str] = None
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None


class InteractionResponse(BaseModel):
    id: int
    hcp_name: str
    interaction_type: str
    date: Optional[str]
    time: Optional[str]
    attendees: Optional[str]
    topics_discussed: Optional[str]
    materials_shared: Optional[str]
    samples_distributed: Optional[str]
    sentiment: Optional[str]
    outcomes: Optional[str]
    follow_up_actions: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    current_form_data: Optional[dict] = {}


class AgentChatResponse(BaseModel):
    reply: str
    action: Optional[str] = None
    extracted_data: Optional[dict] = None
    follow_up_suggestions: Optional[list] = []
    interaction_id: Optional[int] = None
