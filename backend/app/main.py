
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from backend.app.agent.repair_engine import repair_project
from backend.app.schemas.evidence import RepairReport
from backend.app.schemas.job import (
    RepairJobResponse,
    RepairSubmissionResponse,
)
from backend.app.services.report_store import load_report, save_report

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEMO_SOURCE_PATH = "fixtures/buggy_example.py"
DEMO_TEST_PATH = "fixtures/test_buggy_example.py"
DEMO_EXPECTED_FAILURE = "test_full_discount"

app = FastAPI(
    title="ProofLoop API",
    description="Evidence-driven AI code repair and regression verification.",
    version="0.1.0",
)


class RepairRequest(BaseModel):
    """Request to repair the controlled ProofLoop demo fixture."""

    model_config = ConfigDict(extra="forbid")

    bug_report: str = Field(min_length=10, max_length=4_000)


class HealthResponse(BaseModel):
    status: Literal["ok"]


def execute_repair_job(job_id: UUID, bug_report: str) -> None:
    """Execute a repair in the background and persist each job state."""
    try:
        job_data = load_report(job_id)

        if job_data is None:
            raise ValueError("Queued repair job was not found.")

        now = datetime.now(timezone.utc)
        job_data["state"] = "running"
        job_data["updated_at"] = now.isoformat()
        save_report(job_id, job_data)

        raw_report = repair_project(
            project_root=PROJECT_ROOT,
            bug_report=bug_report,
            source_path=DEMO_SOURCE_PATH,
            test_path=DEMO_TEST_PATH,
            expected_failure=DEMO_EXPECTED_FAILURE,
        )

        validated_report = RepairReport.model_validate({
            **raw_report,
            "project": "ProofLoop",
            "timestamp_utc": datetime.now(timezone.utc),
        })

        job_data["state"] = "completed"
        job_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        job_data["report"] = validated_report.model_dump(mode="json")
        job_data["error"] = None

        save_report(job_id, job_data)

        logger.info(
            "Repair job %s completed with status %s",
            job_id,
            validated_report.status,
        )

    except Exception:
        logger.exception("Repair job %s failed", job_id)

        try:
            failed_job = load_report(job_id)

            if failed_job is not None:
                failed_job["state"] = "failed"
                failed_job["updated_at"] = datetime.now(timezone.utc).isoformat()
                failed_job["error"] = (
                    "The repair job could not be completed. "
                    "Check the server logs for details."
                )
                save_report(job_id, failed_job)

        except Exception:
            logger.exception(
                "Could not persist failed state for repair job %s",
                job_id,
            )


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check() -> HealthResponse:
    """Confirm that the API process is responsive."""
    return HealthResponse(status="ok")


@app.post(
    "/api/v1/repairs",
    response_model=RepairSubmissionResponse,
    status_code=201,
    tags=["Repairs"],
)
def create_repair(
    request: RepairRequest,
    background_tasks: BackgroundTasks,
) -> RepairSubmissionResponse:
    """Create a queued repair job and schedule its background execution."""
    job_id = uuid4()
    now = datetime.now(timezone.utc)

    job_data = {
        "job_id": str(job_id),
        "state": "queued",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "report": None,
        "error": None,
    }

    try:
        # Persist the job before scheduling it.
        save_report(job_id, job_data)

        background_tasks.add_task(
            execute_repair_job,
            job_id,
            request.bug_report,
        )

        return RepairSubmissionResponse(
            job_id=job_id,
            state="queued",
            report_url=f"/api/v1/repairs/{job_id}",
        )

    except Exception:
        logger.exception("Could not create repair job")
        raise HTTPException(
            status_code=500,
            detail="The repair job could not be created.",
        ) from None


@app.get(
    "/api/v1/repairs/{job_id}",
    response_model=RepairJobResponse,
    tags=["Repairs"],
)
def get_repair(job_id: UUID) -> RepairJobResponse:
    """Retrieve the latest state and report for a repair job."""
    try:
        saved_job = load_report(job_id)
    except (OSError, ValueError):
        logger.exception("Could not read saved repair job")
        raise HTTPException(
            status_code=500,
            detail="The saved repair job could not be read.",
        ) from None

    if saved_job is None:
        raise HTTPException(
            status_code=404,
            detail="Repair job not found.",
        )

    try:
        return RepairJobResponse.model_validate(saved_job)
    except Exception:
        logger.exception("Saved repair job failed schema validation")
        raise HTTPException(
            status_code=500,
            detail="The saved repair job is invalid.",
        ) from None
