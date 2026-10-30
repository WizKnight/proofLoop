import pytest
from fastapi.testclient import TestClient

from backend.app import main


@pytest.fixture
def client():
    return TestClient(main.app)


def make_verified_report():
    diff = (
        "--- original/fixtures/buggy_example.py\n"
        "+++ patched/fixtures/buggy_example.py\n"
        "-        return price\n"
        "+        return 0\n"
    )

    return {
        "status": "verified",
        "summary": "Baseline failure reproduced and regression tests passed.",
        "evidence": [
            {
                "step": "baseline_tests",
                "execution_id": "00000000-0000-4000-8000-000000000001",
                "command": [
                    "docker",
                    "run",
                    "proofloop-sandbox:local",
                    "python",
                    "-m",
                    "pytest",
                ],
                "executor": "docker",
                "sandbox_image": "proofloop-sandbox:local",
                "execution_started": True,
                "exit_code": 1,
                "stdout": "1 failed, 4 passed",
                "stderr": "",
                "timed_out": False,
                "expected_failure": "test_full_discount",
                "failure_reproduced": True,
                "source_path": "fixtures/buggy_example.py",
                "source_sha256": "a" * 64,
            },
            {
                "step": "patch_generation",
                "success": True,
                "summary": "Fix full discount handling.",
                "edits": [
                    {
                        "path": "fixtures/buggy_example.py",
                        "old_text": "return price",
                        "new_text": "return 0",
                        "explanation": "A 100% discount must return zero.",
                    }
                ],
            },
            {
                "step": "patch_application",
                "success": True,
                "source_path": "fixtures/buggy_example.py",
                "source_sha256_before": "a" * 64,
                "source_sha256_after": "b" * 64,
                "diff": diff,
            },
            {
                "step": "post_patch_tests",
                "execution_id": "00000000-0000-4000-8000-000000000002",
                "command": [
                    "docker",
                    "run",
                    "proofloop-sandbox:local",
                    "python",
                    "-m",
                    "pytest",
                ],
                "executor": "docker",
                "sandbox_image": "proofloop-sandbox:local",
                "execution_started": True,
                "exit_code": 0,
                "stdout": "5 passed",
                "stderr": "",
                "timed_out": False,
                "tests_passed": True,
            },
        ],
        "patch_summary": "Fix full discount handling",
        "diff": diff,
        "verification_scope": (
            "The supplied regression suite passed; "
            "this does not prove the absence of all bugs."
        ),
    }


def test_health_endpoint(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}




def test_repair_endpoint_creates_persisted_job(
    client,
    monkeypatch,
):
    saved_jobs = {}

    monkeypatch.setattr(
        main,
        "repair_project",
        lambda **kwargs: make_verified_report(),
    )

    monkeypatch.setattr(
        main,
        "save_report",
        lambda job_id, report: saved_jobs.__setitem__(
            str(job_id), report.copy()
        ),
    )

    monkeypatch.setattr(
        main,
        "load_report",
        lambda job_id: saved_jobs.get(str(job_id)),
    )

    response = client.post(
        "/api/v1/repairs",
        json={
            "bug_report": (
                "A 100% discount should return zero instead of "
                "the original price."
            )
        },
    )

    assert response.status_code == 201

    submission = response.json()
    job_id = submission['job_id']

    assert submission["state"] == "queued"
    assert submission["report_url"] == f"/api/v1/repairs/{job_id}"
    assert job_id in saved_jobs

    # TestClient executes FastAPI background tasks before returning.
    stored = saved_jobs[job_id]

    assert stored["state"] == "completed"
    assert stored["report"]["status"] == "verified"
    assert len(stored["report"]["evidence"]) == 4
    assert stored["error"] is None



def test_get_repair_returns_saved_report(client, monkeypatch):
    from datetime import datetime, timezone
    from uuid import uuid4

    job_id = uuid4()
    stored_job = {
        "job_id": str(job_id),
        "state": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "report": make_verified_report()
        | {
            "project": "ProofLoop",
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        },
    }

    monkeypatch.setattr(
        main,
        "load_report",
        lambda requested_id: (
            stored_job if requested_id == job_id else None
        ),
    )

    response = client.get(f"/api/v1/repairs/{job_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["job_id"] == str(job_id)
    assert body["state"] == "completed"
    assert body["report"]["status"] == "verified"


def test_get_repair_returns_404_for_unknown_job(client, monkeypatch):
    from uuid import uuid4

    monkeypatch.setattr(main, "load_report", lambda job_id: None)

    response = client.get(f"/api/v1/repairs/{uuid4()}")

    assert response.status_code == 404


def test_get_repair_rejects_invalid_job_id(client):
    response = client.get("/api/v1/repairs/not-a-uuid")

    assert response.status_code == 422



def test_repair_endpoint_rejects_short_bug_report(client):
    response = client.post(
        "/api/v1/repairs",
        json={"bug_report": "Too short"},
    )

    assert response.status_code == 422


def test_repair_endpoint_rejects_unknown_request_fields(client):
    response = client.post(
        "/api/v1/repairs",
        json={
            "bug_report": "Fix the full discount calculation bug.",
            "source_path": "../../.env",
        },
    )

    assert response.status_code == 422


def test_background_repair_failure_is_persisted(client, monkeypatch):
    saved_jobs = {}

    def fail_repair(**kwargs):
        raise RuntimeError("internal test failure")

    monkeypatch.setattr(main, "repair_project", fail_repair)
    monkeypatch.setattr(
        main,
        "save_report",
        lambda job_id, report: saved_jobs.__setitem__(
            str(job_id), report.copy()
        ),
    )
    monkeypatch.setattr(
        main,
        "load_report",
        lambda job_id: saved_jobs.get(str(job_id)),
    )

    response = client.post(
        "/api/v1/repairs",
        json={"bug_report": "Fix the full discount calculation bug."},
    )

    assert response.status_code == 201
    assert response.json()["state"] == "queued"

    job_id = response.json()["job_id"]
    stored = saved_jobs[job_id]

    assert stored["state"] == "failed"
    assert stored["report"] is None
    assert "internal test failure" not in str(stored)
    assert "could not be completed" in stored["error"]
