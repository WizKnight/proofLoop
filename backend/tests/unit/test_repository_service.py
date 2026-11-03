
from pathlib import Path

import pytest

from backend.app.schemas.execution import ExecutionResult
from backend.app.services import repository_service


def create_sample_repository(root: Path) -> None:
    (root / "src").mkdir(parents=True)
    (root / "tests").mkdir()

    (root / "src" / "app.py").write_text(
        "def add(a, b):\n    return a + b\n",
        encoding="utf-8",
    )

    (root / "tests" / "test_app.py").write_text(
        "from src.app import add\n\n"
        "def test_add():\n"
        "    assert add(2, 3) == 5\n",
        encoding="utf-8",
    )


def successful_execution() -> dict:
    return ExecutionResult(
        executor="docker",
        sandbox_image="proofloop-sandbox:local",
        execution_started=True,
        command=["docker", "run", "pytest"],
        exit_code=0,
        stdout="1 passed",
        stderr="",
        timed_out=False,
    ).model_dump(mode="json")


def test_prepare_repository_discovers_and_runs_tests(
    tmp_path: Path,
    monkeypatch,
):
    create_sample_repository(tmp_path)

    calls = []

    def fake_run_pytest(
        workspace_root,
        test_path,
        timeout_seconds=30,
    ):
        calls.append(
            {
                "workspace_root": workspace_root,
                "test_path": test_path,
                "timeout_seconds": timeout_seconds,
            }
        )
        return successful_execution()

    monkeypatch.setattr(
        repository_service,
        "run_pytest",
        fake_run_pytest,
    )

    preparation = repository_service.prepare_repository(
        tmp_path,
        timeout_seconds=45,
    )

    try:
        assert preparation.manifest.source_files == ["src/app.py"]
        assert preparation.manifest.test_files == ["tests/test_app.py"]

        assert preparation.test_targets == ["tests/test_app.py"]

        assert preparation.workspace_root.is_dir()
        assert (preparation.workspace_root / "src/app.py").is_file()
        assert (preparation.workspace_root / "tests/test_app.py").is_file()

        assert preparation.baseline_execution.exit_code == 0
        assert preparation.baseline_execution.execution_started is True

        assert len(calls) == 1
        assert calls[0]["test_path"] == ["tests/test_app.py"]
        assert calls[0]["timeout_seconds"] == 45

        # The original repository must remain unchanged.
        assert (tmp_path / "src/app.py").is_file()

    finally:
        workspace_path = preparation.workspace_root
        preparation.cleanup()
        assert not workspace_path.exists()


def test_prepare_repository_rejects_project_without_source(
    tmp_path: Path,
):
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_app.py").write_text(
        "def test_app():\n    assert True\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="no Python source"):
        repository_service.prepare_repository(tmp_path)


def test_prepare_repository_rejects_project_without_tests(
    tmp_path: Path,
):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.py").write_text(
        "VALUE = 1\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="no discoverable pytest"):
        repository_service.prepare_repository(tmp_path)


def test_prepare_repository_preserves_docker_start_failure(
    tmp_path: Path,
    monkeypatch,
):
    create_sample_repository(tmp_path)

    failed_execution = ExecutionResult(
        executor="docker",
        sandbox_image="proofloop-sandbox:local",
        execution_started=False,
        command=["docker", "run"],
        exit_code=None,
        stdout="",
        stderr="Could not start Docker",
        timed_out=False,
    ).model_dump(mode="json")

    monkeypatch.setattr(
        repository_service,
        "run_pytest",
        lambda **kwargs: failed_execution,
    )

    preparation = repository_service.prepare_repository(tmp_path)

    try:
        assert preparation.baseline_execution.execution_started is False
        assert preparation.baseline_execution.exit_code is None
        assert "Could not start Docker" in preparation.baseline_execution.stderr
    finally:
        preparation.cleanup()


def test_prepare_repository_cleans_workspace_on_execution_exception(
    tmp_path: Path,
    monkeypatch,
):
    create_sample_repository(tmp_path)

    captured = {}

    original_create = repository_service.create_repository_workspace

    def capture_workspace(*args, **kwargs):
        workspace = original_create(*args, **kwargs)
        captured["path"] = Path(workspace.name)
        return workspace

    def fail_execution(**kwargs):
        raise RuntimeError("Unexpected execution error")

    monkeypatch.setattr(
        repository_service,
        "create_repository_workspace",
        capture_workspace,
    )

    monkeypatch.setattr(
        repository_service,
        "run_pytest",
        fail_execution,
    )

    with pytest.raises(RuntimeError, match="Unexpected execution"):
        repository_service.prepare_repository(tmp_path)

    assert captured["path"].exists() is False
