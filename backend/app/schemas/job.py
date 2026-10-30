
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from backend.app.schemas.evidence import RepairReport


JobState = Literal["queued", "running", "completed", "failed"]


class RepairJobResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: UUID
    state: JobState
    created_at: datetime
    updated_at: datetime
    report: RepairReport | None = None
    error: str | None = None


class RepairSubmissionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: UUID
    state: Literal["queued"] = "queued"
    report_url: str
