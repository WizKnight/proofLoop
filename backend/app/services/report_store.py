import json
import os
from pathlib import Path
from typing import Any
from uuid import UUID


PROJECT_ROOT = Path(__file__).resolve().parents[3]
REPORTS_DIR = PROJECT_ROOT / "artifacts" / "repairs"


def _report_path(job_id: str | UUID) -> Path:
    """Resolve a report path from a validated UUID."""
    validated_id = UUID(str(job_id))
    return REPORTS_DIR / f"{validated_id}.json"


def save_report(job_id: str | UUID, report: dict[str, Any]) -> None:
    """Persist a report atomically as JSON."""
    destination = _report_path(job_id)
    destination.parent.mkdir(parents=True, exist_ok=True)

    temporary_path = destination.with_suffix(".tmp")

    try:
        temporary_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        os.replace(temporary_path, destination)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def load_report(job_id: str | UUID) -> dict[str, Any] | None:
    """Load a saved report, returning None if it does not exist."""
    path = _report_path(job_id)

    if not path.is_file():
        return None

    data = json.loads(path.read_text(encoding="utf-8"))

    if not isinstance(data, dict):
        raise ValueError("Stored report must be a JSON object")

    return data
