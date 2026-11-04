
from datetime import datetime
from typing import Literal
from typing import Optional

from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ConversationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4_000)
    client_request_id: Optional[UUID | str] = Field(default=None)


class ConversationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    client_request_id: Optional[UUID | str] = None


class ConversationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    messages: list[ConversationMessage]
    reply: str | None = None
