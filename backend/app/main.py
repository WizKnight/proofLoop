
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from fastapi import (
    BackgroundTasks,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from backend.app.agent.repair_engine import repair_project, repair_repository
from backend.app.schemas.evidence import RepairReport
from backend.app.schemas.job import (
    RepairHistoryItem,
    RepairJobResponse,
    RepairSubmissionResponse,
)
from backend.app.services.report_store import list_reports, load_report, save_report
from backend.app.services.repository_analyzer import analyze_repository
from backend.app.services.upload_service import (
    MAX_ARCHIVE_BYTES,
    extract_repository_zip,
)

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "OPTIONS",
    ],
    allow_headers=[
        "Content-Type",
    ],
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

def execute_repository_repair_job(
    job_id: UUID,
    bug_report: str,
    expected_failure: str,
    upload_workspace,
) -> None:
    """Execute an uploaded repository repair and persist its result."""
    try:
        job_data = load_report(job_id)

        if job_data is None:
            raise ValueError("Queued repository repair job was not found.")

        now = datetime.now(timezone.utc)
        job_data["state"] = "running"
        job_data["updated_at"] = now.isoformat()
        save_report(job_id, job_data)

        raw_report = repair_repository(
            project_root=Path(upload_workspace.name),
            bug_report=bug_report,
            expected_failure=expected_failure,
        )

        validated_report = RepairReport.model_validate({
            **raw_report,
            "project": "Uploaded Python repository",
            "timestamp_utc": datetime.now(timezone.utc),
        })

        job_data["state"] = "completed"
        job_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        job_data["report"] = validated_report.model_dump(mode="json")
        job_data["error"] = None

        save_report(job_id, job_data)

        logger.info(
            "Repository repair job %s completed with status %s",
            job_id,
            validated_report.status,
        )

    except Exception:
        logger.exception("Repository repair job %s failed", job_id)

        try:
            failed_job = load_report(job_id)

            if failed_job is not None:
                failed_job["state"] = "failed"
                failed_job["updated_at"] = (
                    datetime.now(timezone.utc).isoformat()
                )
                failed_job["error"] = (
                    "The repository repair job could not be completed. "
                    "Check the server logs for details."
                )
                save_report(job_id, failed_job)

        except Exception:
            logger.exception(
                "Could not persist failed repository job %s",
                job_id,
            )

    finally:
        upload_workspace.cleanup()


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


@app.post(
    "/api/v1/repairs/repository",
    response_model=RepairSubmissionResponse,
    status_code=201,
    tags=["Repairs"],
)
async def create_repository_repair(
    background_tasks: BackgroundTasks,
    repository: UploadFile = File(...),
    bug_report: str = Form(..., min_length=10, max_length=4_000),
    expected_failure: str = Form(..., min_length=1, max_length=300),
) -> RepairSubmissionResponse:
    """Accept a ZIP repository and schedule an evidence-driven repair."""

    upload_workspace = None

    try:
        # Read the upload incrementally instead of trusting Content-Length.
        chunks: list[bytes] = []
        total_bytes = 0

        while True:
            chunk = await repository.read(64 * 1024)

            if not chunk:
                break

            total_bytes += len(chunk)

            if total_bytes > MAX_ARCHIVE_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="Uploaded ZIP exceeds the 25 MiB limit.",
                )

            chunks.append(chunk)

        archive_data = b"".join(chunks)

        if not archive_data:
            raise HTTPException(
                status_code=400,
                detail="Uploaded repository archive is empty.",
            )

        # Safely extract into a temporary directory.
        upload_workspace = extract_repository_zip(archive_data)

        # Analyze without executing repository code.
        manifest = analyze_repository(Path(upload_workspace.name))

        if not manifest.source_files:
            raise HTTPException(
                status_code=422,
                detail="Repository contains no Python source files.",
            )

        usable_tests = [
            path
            for path in manifest.test_files
            if Path(path).name != "conftest.py"
        ]

        if not usable_tests:
            raise HTTPException(
                status_code=422,
                detail="Repository contains no discoverable pytest tests.",
            )

        # Create the job only after upload validation succeeds.
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

        save_report(job_id, job_data)

        background_tasks.add_task(
            execute_repository_repair_job,
            job_id,
            bug_report,
            expected_failure,
            upload_workspace,
        )

        # Ownership transfers to the background task.
        upload_workspace = None

        return RepairSubmissionResponse(
            job_id=job_id,
            state="queued",
            report_url=f"/api/v1/repairs/{job_id}",
        )

    except HTTPException:
        raise

    except ValueError as exc:
        logger.warning("Repository upload rejected: %s", exc)

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from None

    except Exception:
        logger.exception("Could not create repository repair job")

        raise HTTPException(
            status_code=500,
            detail="The repository repair job could not be created.",
        ) from None

    finally:
        await repository.close()

        # Clean up if ownership was not transferred to the background task.
        if upload_workspace is not None:
            upload_workspace.cleanup()


@app.get(
    "/api/v1/repairs",
    response_model=list[RepairHistoryItem],
    tags=["Repairs"],
)
def list_repairs(
    limit: int = Query(default=20, ge=1, le=100),
) -> list[RepairHistoryItem]:
    """Return recent repair jobs with independently validated report status."""
    try:
        saved_jobs = list_reports(limit=limit)
    except (OSError, ValueError):
        logger.exception("Could not list saved repair jobs")
        raise HTTPException(
            status_code=500,
            detail="Repair history could not be retrieved.",
        ) from None

    history: list[RepairHistoryItem] = []

    for job in saved_jobs:
        try:
            job_id_raw = job.get("job_id")
            state_raw = job.get("state")
            created_at_raw = job.get("created_at")
            updated_at_raw = job.get("updated_at")

            if job_id_raw is None:
                raise ValueError("Missing job_id")

            job_id_value = UUID(str(job_id_raw))

            if state_raw not in {"queued", "running", "completed", "failed"}:
                raise ValueError(f"Invalid job state: {state_raw!r}")

            if created_at_raw is None:
                raise ValueError("Missing created_at")

            created_at_value = datetime.fromisoformat(str(created_at_raw))
            updated_at_value = (
                datetime.fromisoformat(str(updated_at_raw))
                if updated_at_raw is not None
                else None
            )

            job_metadata = {
                "job_id": job_id_value,
                "state": state_raw,
                "created_at": created_at_value,
                "updated_at": updated_at_value,
                "error": job.get("error"),
            }

            report_data = job.get("report")

            if report_data is None:
                history_item = RepairHistoryItem(
                    **job_metadata,
                    report_integrity="not_available",
                )
            else:
                try:
                    validated_report = RepairReport.model_validate(report_data)

                    history_item = RepairHistoryItem(
                        **job_metadata,
                        report_integrity="valid",
                        report_status=validated_report.status,
                        summary=validated_report.summary,
                    )

                except ValidationError:
                    logger.warning(
                        "Repair report %s failed current validation; "
                        "excluding its report status from history.",
                        job_id_value,
                    )

                    history_item = RepairHistoryItem(
                        **job_metadata,
                        report_integrity="invalid",
                    )

            history.append(history_item)

        except (TypeError, ValueError, ValidationError):
            logger.exception(
                "Skipping repair history entry with invalid job metadata: %s",
                job.get("job_id"),
            )

    return history

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
