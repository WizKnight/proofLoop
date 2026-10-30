from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ExecutionResult(BaseModel):
    """Structured result returned by a sandbox execution."""

    model_config = ConfigDict(extra="forbid")

    execution_id: UUID = Field(default_factory=uuid4)
    executor: Literal["docker"]
    sandbox_image: str = Field(min_length=1)
    execution_started: bool
    command: list[str] = Field(min_length=1)

    exit_code: int | None = None
    stdout: str
    stderr: str
    timed_out: bool

    @model_validator(mode="after")
    def validate_execution_state(self) -> "ExecutionResult":
        if not self.execution_started:
            if self.exit_code is not None or self.timed_out:
                raise ValueError(
                    "An execution that did not start cannot have an exit code or timeout"
                )

        if self.timed_out and self.exit_code is not None:
            raise ValueError(
                "A timed-out execution must not report a completed exit code"
            )

        return self
