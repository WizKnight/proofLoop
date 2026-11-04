import pytest
from fastapi.testclient import TestClient
import io
import zipfile

from backend.app import main


@pytest.fixture
def client(monkeypatch):
    test_token = "proofloop-test-token"
    monkeypatch.setenv("PROOFLOOP_DEMO_TOKEN", test_token)

    return TestClient(
        main.app,
        headers={"Authorization": f"Bearer {test_token}"},
    )


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

    status_response = client.get(
        f"/api/v1/repairs/{job_id}"
    )

    assert status_response.status_code == 200
    assert status_response.json()["state"] == "failed"
    assert status_response.json()["error"] == (
        "The repair job could not be completed. "
        "Check the server logs for details."
    )


def test_repair_endpoint_rejects_oversized_bug_report(client):
    response = client.post(
        "/api/v1/repairs",
        json={"bug_report": "A" * 4001},
    )

    assert response.status_code == 422


def test_get_repair_hides_storage_errors(client, monkeypatch):
    def fail_to_load(job_id):
        raise OSError("Sensitive internal filesystem path")

    monkeypatch.setattr(main, "load_report", fail_to_load)

    response = client.get(
        "/api/v1/repairs/00000000-0000-4000-8000-000000000001"
    )

    assert response.status_code == 500
    assert response.json()["detail"] == (
        "The saved repair job could not be read."
    )
    assert "Sensitive internal filesystem path" not in response.text

    def test_list_repairs_returns_recent_jobs(client, monkeypatch):
        from datetime import datetime, timezone
        from uuid import uuid4

        first_id = uuid4()
        second_id = uuid4()
        now = datetime.now(timezone.utc).isoformat()

        saved_jobs = [
            {
                "job_id": str(first_id),
                "state": "completed",
                "created_at": now,
                "updated_at": now,
                "report": None,
                "error": None,
            },
            {
                "job_id": str(second_id),
                "state": "running",
                "created_at": now,
                "updated_at": now,
                "report": None,
                "error": None,
            },
        ]

        monkeypatch.setattr(
            main,
            "list_reports",
            lambda limit: saved_jobs[:limit],
        )

        response = client.get("/api/v1/repairs")

        assert response.status_code == 200
        assert len(response.json()) == 2
        assert response.json()[0]["job_id"] == str(first_id)
        assert response.json()[1]["job_id"] == str(second_id)


def test_list_repairs_respects_limit(client, monkeypatch):
    monkeypatch.setattr(
        main,
        "list_reports",
        lambda limit: [],
    )

    response = client.get("/api/v1/repairs?limit=5")

    assert response.status_code == 200
    assert response.json() == []


def test_list_repairs_rejects_invalid_limit(client):
    response = client.get("/api/v1/repairs?limit=0")

    assert response.status_code == 422


def make_repository_zip() -> bytes:
    """Create a small valid Python repository ZIP."""
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "project/app.py",
            "def calculate_discount(price, percentage):\n"
            "    return price\n",
        )

        archive.writestr(
            "project/tests/test_app.py",
            "from app import calculate_discount\n\n"
            "def test_full_discount():\n"
            "    assert calculate_discount(100, 100) == 0\n",
        )

    return buffer.getvalue()

def make_multi_file_verified_report():
    data = make_verified_report()

    diff = (
        "--- original/project/app.py\n"
        "+++ patched/project/app.py\n"
        "-    return price\n"
        "+    return 0\n"
        "--- original/project/utils.py\n"
        "+++ patched/project/utils.py\n"
        "-    return value\n"
        "+    return value * 1\n"
    )

    changed_files = [
        {
            "path": "project/app.py",
            "source_sha256_before": "a" * 64,
            "source_sha256_after": "b" * 64,
        },
        {
            "path": "project/utils.py",
            "source_sha256_before": "c" * 64,
            "source_sha256_after": "d" * 64,
        },
    ]

    data["evidence"][0]["source_path"] = "project/app.py"
    data["evidence"][2]["source_path"] = "project/app.py"
    data["evidence"][2]["diff"] = diff
    data["evidence"][2]["changed_files"] = changed_files

    data["diff"] = diff
    data["root_cause"] = (
        "The discount calculation failed to handle a full discount."
    )
    data["changed_files"] = changed_files

    return data


def test_repository_upload_rejects_empty_archive(client):
    response = client.post(
        "/api/v1/repairs/repository",
        data={
            "bug_report": "Fix the full discount calculation.",
            "expected_failure": "test_full_discount",
        },
        files={
            "repository": (
                "project.zip",
                b"",
                "application/zip",
            ),
        },
    )

    assert response.status_code == 400


def test_repository_upload_rejects_invalid_zip(client):
    response = client.post(
        "/api/v1/repairs/repository",
        data={
            "bug_report": "Fix the full discount calculation.",
            "expected_failure": "test_full_discount",
        },
        files={
            "repository": (
                "project.zip",
                b"not a zip archive",
                "application/zip",
            ),
        },
    )

    assert response.status_code == 422


def test_repository_upload_rejects_missing_tests(client):
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "project/app.py",
            "def calculate_discount(price, percentage):\n"
            "    return price\n",
        )

    response = client.post(
        "/api/v1/repairs/repository",
        data={
            "bug_report": "Fix the full discount calculation.",
            "expected_failure": "test_full_discount",
        },
        files={
            "repository": (
                "project.zip",
                buffer.getvalue(),
                "application/zip",
            ),
        },
    )

    assert response.status_code == 422
    assert "pytest tests" in response.text.lower()

def test_repository_upload_completes_and_cleans_workspace(
    client,
    monkeypatch,
):
    from pathlib import Path

    saved_jobs = {}
    captured_workspace = {}

    original_extract = main.extract_repository_zip

    def tracking_extract(archive_data):
        workspace = original_extract(archive_data)
        captured_workspace["path"] = Path(workspace.name)
        return workspace

    def fake_repair_repository(**kwargs):
        project_root = Path(kwargs["project_root"])

        assert project_root.is_dir()
        assert (project_root / "project/app.py").is_file()
        assert kwargs["bug_report"] == (
            "Fix the full discount calculation."
        )
        assert kwargs["expected_failure"] == "test_full_discount"

        return make_multi_file_verified_report()

    monkeypatch.setattr(
        main,
        "extract_repository_zip",
        tracking_extract,
    )

    monkeypatch.setattr(
        main,
        "repair_repository",
        fake_repair_repository,
    )

    monkeypatch.setattr(
        main,
        "save_report",
        lambda job_id, report: saved_jobs.__setitem__(
            str(job_id),
            report.copy(),
        ),
    )

    monkeypatch.setattr(
        main,
        "load_report",
        lambda job_id: saved_jobs.get(str(job_id)),
    )

    response = client.post(
        "/api/v1/repairs/repository",
        data={
            "bug_report": "Fix the full discount calculation.",
            "expected_failure": "test_full_discount",
        },
        files={
            "repository": (
                "project.zip",
                make_repository_zip(),
                "application/zip",
            ),
        },
    )

    assert response.status_code == 201

    submission = response.json()
    job_id = submission["job_id"]

    assert submission["state"] == "queued"
    assert submission["report_url"] == (
        f"/api/v1/repairs/{job_id}"
    )

    stored = saved_jobs[job_id]

    assert stored["state"] == "completed"
    assert stored["report"]["status"] == "verified"
    assert len(stored["report"]["changed_files"]) == 2
    assert stored["report"]["root_cause"]
    assert stored["error"] is None

    # TestClient executes background tasks before returning.
    assert "path" in captured_workspace
    assert not captured_workspace["path"].exists()

def test_repository_repair_failure_is_persisted_and_cleaned(
    client,
    monkeypatch,
):
    from pathlib import Path

    saved_jobs = {}
    captured = {}

    original_extract = main.extract_repository_zip

    def tracking_extract(archive_data):
        workspace = original_extract(archive_data)
        captured["path"] = Path(workspace.name)
        return workspace

    def fail_repair(**kwargs):
        raise RuntimeError("simulated repository repair failure")

    monkeypatch.setattr(main, "extract_repository_zip", tracking_extract)
    monkeypatch.setattr(main, "repair_repository", fail_repair)

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
        "/api/v1/repairs/repository",
        data={
            "bug_report": "Fix the full discount calculation.",
            "expected_failure": "test_full_discount",
        },
        files={
            "repository": (
                "project.zip",
                make_repository_zip(),
                "application/zip",
            ),
        },
    )

    assert response.status_code == 201

    job_id = response.json()["job_id"]
    stored = saved_jobs[job_id]

    assert stored["state"] == "failed"
    assert stored["report"] is None
    assert "simulated repository repair failure" not in str(stored)
    assert "could not be completed" in stored["error"]

    assert "path" in captured
    assert not captured["path"].exists()


def test_repository_repair_rejects_invalid_verified_report(
    client,
    monkeypatch,
):
    from pathlib import Path

    saved_jobs = {}
    captured = {}

    original_extract = main.extract_repository_zip

    def tracking_extract(archive_data):
        workspace = original_extract(archive_data)
        captured["path"] = Path(workspace.name)
        return workspace

    def invalid_repair(**kwargs):
        data = make_multi_file_verified_report()

        # Deliberately corrupt the primary file's after hash.
        data["changed_files"][0]["source_sha256_after"] = "e" * 64
        data["evidence"][2]["changed_files"] = data["changed_files"]

        return data

    monkeypatch.setattr(main, "extract_repository_zip", tracking_extract)
    monkeypatch.setattr(main, "repair_repository", invalid_repair)

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
        "/api/v1/repairs/repository",
        data={
            "bug_report": "Fix the full discount calculation.",
            "expected_failure": "test_full_discount",
        },
        files={
            "repository": (
                "project.zip",
                make_repository_zip(),
                "application/zip",
            ),
        },
    )

    assert response.status_code == 201

    job_id = response.json()["job_id"]
    stored = saved_jobs[job_id]

    assert stored["state"] == "failed"
    assert stored["report"] is None
    assert "could not be completed" in stored["error"]

    assert not captured["path"].exists()


def test_repository_upload_cleans_workspace_when_analysis_fails(
    client,
    monkeypatch,
):
    from pathlib import Path

    captured = {}
    saved_jobs = {}

    original_extract = main.extract_repository_zip

    def tracking_extract(archive_data):
        workspace = original_extract(archive_data)
        captured["path"] = Path(workspace.name)
        return workspace

    def fail_analysis(project_root):
        raise ValueError("simulated repository analysis failure")

    monkeypatch.setattr(main, "extract_repository_zip", tracking_extract)
    monkeypatch.setattr(main, "analyze_repository", fail_analysis)

    monkeypatch.setattr(
        main,
        "save_report",
        lambda job_id, report: saved_jobs.__setitem__(
            str(job_id), report.copy()
        ),
    )

    response = client.post(
        "/api/v1/repairs/repository",
        data={
            "bug_report": "Fix the full discount calculation.",
            "expected_failure": "test_full_discount",
        },
        files={
            "repository": (
                "project.zip",
                make_repository_zip(),
                "application/zip",
            ),
        },
    )

    assert response.status_code == 422
    assert "simulated repository analysis failure" in response.text

    assert captured["path"].exists() is False
    assert saved_jobs == {}

from datetime import datetime, timezone
from uuid import uuid4


def make_completed_conversation_job():
    now = datetime.now(timezone.utc).isoformat()

    return {
        "job_id": str(uuid4()),
        "state": "completed",
        "created_at": now,
        "updated_at": now,
        "report": make_verified_report() | {
            "project": "ProofLoop",
            "timestamp_utc": now,
        },
        "error": None,
    }


def test_conversation_sends_message_and_persists_exchange(
    client,
    monkeypatch,
):
    job = make_completed_conversation_job()
    saved = {}
    generated = {}

    monkeypatch.setattr(
        main,
        "load_report",
        lambda job_id: job,
    )
    monkeypatch.setattr(
        main,
        "load_conversation",
        lambda job_id: [],
    )

    def fake_answer(**kwargs):
        generated.update(kwargs)
        return "The incorrect special case caused the bug."

    monkeypatch.setattr(
        main,
        "generate_repair_answer",
        fake_answer,
    )

    monkeypatch.setattr(
        main,
        "save_conversation",
        lambda job_id, messages: saved.update(
            messages=messages
        ),
    )

    response = client.post(
        f"/api/v1/repairs/{job['job_id']}/conversation",
        json={"message": "Explain the root cause."},
    )

    assert response.status_code == 200

    body = response.json()

    assert body["job_id"] == job["job_id"]
    assert body["reply"] == (
        "The incorrect special case caused the bug."
    )
    assert len(body["messages"]) == 2
    assert body["messages"][0]["role"] == "user"
    assert body["messages"][1]["role"] == "assistant"

    assert generated["question"] == "Explain the root cause."
    assert generated["report"]["status"] == "verified"

    assert len(saved["messages"]) == 2


def test_get_conversation_returns_persisted_history(
    client,
    monkeypatch,
):
    job = make_completed_conversation_job()

    history = [
        {
            "id": "message-1",
            "role": "user",
            "content": "Explain the bug.",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": "message-2",
            "role": "assistant",
            "content": "The special case returned the wrong value.",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    monkeypatch.setattr(
        main,
        "load_report",
        lambda job_id: job,
    )
    monkeypatch.setattr(
        main,
        "load_conversation",
        lambda job_id: history,
    )

    response = client.get(
        f"/api/v1/repairs/{job['job_id']}/conversation"
    )

    assert response.status_code == 200
    assert len(response.json()) == 2
    assert response.json()[0]["content"] == "Explain the bug."
    assert response.json()[1]["role"] == "assistant"


def test_conversation_returns_404_for_unknown_job(
    client,
    monkeypatch,
):
    monkeypatch.setattr(
        main,
        "load_report",
        lambda job_id: None,
    )

    job_id = uuid4()

    response = client.post(
        f"/api/v1/repairs/{job_id}/conversation",
        json={"message": "Explain the bug."},
    )

    assert response.status_code == 404


def test_conversation_rejects_incomplete_job(
    client,
    monkeypatch,
):
    job = make_completed_conversation_job()
    job["state"] = "running"

    monkeypatch.setattr(
        main,
        "load_report",
        lambda job_id: job,
    )

    response = client.post(
        f"/api/v1/repairs/{job['job_id']}/conversation",
        json={"message": "Explain the bug."},
    )

    assert response.status_code == 409


def test_conversation_rejects_invalid_messages(client):
    job_id = uuid4()

    empty_response = client.post(
        f"/api/v1/repairs/{job_id}/conversation",
        json={"message": ""},
    )

    oversized_response = client.post(
        f"/api/v1/repairs/{job_id}/conversation",
        json={"message": "A" * 4001},
    )

    assert empty_response.status_code == 422
    assert oversized_response.status_code == 422


def test_meta_failure_does_not_persist_partial_exchange(
    client,
    monkeypatch,
):
    job = make_completed_conversation_job()
    existing_history = [
        {
            "id": "existing-message",
            "role": "user",
            "content": "Previous question.",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ]
    save_called = False

    monkeypatch.setattr(
        main,
        "load_report",
        lambda job_id: job,
    )
    monkeypatch.setattr(
        main,
        "load_conversation",
        lambda job_id: existing_history,
    )

    def fail_generation(**kwargs):
        raise RuntimeError("Simulated Meta API failure")

    monkeypatch.setattr(
        main,
        "generate_repair_answer",
        fail_generation,
    )

    def track_save(job_id, messages):
        nonlocal save_called
        save_called = True

    monkeypatch.setattr(
        main,
        "save_conversation",
        track_save,
    )

    response = client.post(
        f"/api/v1/repairs/{job['job_id']}/conversation",
        json={"message": "Explain the bug."},
    )

    assert response.status_code == 502
    assert save_called is False
    assert len(existing_history) == 1


def test_conversation_rejects_exchange_when_limit_reached(
    client,
    monkeypatch,
):
    job = make_completed_conversation_job()
    existing_history = [{"role": "user"} for _ in range(40)]
    generation_called = False

    monkeypatch.setattr(
        main,
        "load_report",
        lambda job_id: job,
    )
    monkeypatch.setattr(
        main,
        "load_conversation",
        lambda job_id: existing_history,
    )

    def track_generation(**kwargs):
        nonlocal generation_called
        generation_called = True
        return "Unexpected response"

    monkeypatch.setattr(
        main,
        "generate_repair_answer",
        track_generation,
    )

    response = client.post(
        f"/api/v1/repairs/{job['job_id']}/conversation",
        json={"message": "Explain the bug."},
    )

    assert response.status_code == 409
    assert generation_called is False


def test_auth_verify_accepts_valid_demo_token(client):
    response = client.get("/api/v1/auth/verify")

    assert response.status_code == 200
    assert response.json() == {"authenticated": True}


def test_protected_api_rejects_missing_token(monkeypatch):
    monkeypatch.setenv("PROOFLOOP_DEMO_TOKEN", "expected-token")
    unauthenticated_client = TestClient(main.app)

    response = unauthenticated_client.get("/api/v1/repairs")

    assert response.status_code == 401


def test_protected_api_rejects_invalid_token(monkeypatch):
    monkeypatch.setenv("PROOFLOOP_DEMO_TOKEN", "expected-token")
    unauthenticated_client = TestClient(
        main.app,
        headers={"Authorization": "Bearer wrong-token"},
    )

    response = unauthenticated_client.get("/api/v1/repairs")

    assert response.status_code == 401


def test_protected_api_fails_closed_without_configured_token(monkeypatch):
    monkeypatch.delenv("PROOFLOOP_DEMO_TOKEN", raising=False)
    unauthenticated_client = TestClient(main.app)

    response = unauthenticated_client.get("/api/v1/repairs")

    assert response.status_code == 503