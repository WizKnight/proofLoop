from pathlib import Path

from backend.app.services import workspace_service
from backend.app.schemas.repository import RepositoryManifest


def test_docker_start_failure_does_not_fall_back_to_host(
    tmp_path: Path,
    monkeypatch,
):
    test_file = tmp_path / "test_sample.py"
    test_file.write_text("def test_sample():\n    assert True\n", encoding="utf-8")

    attempted_commands = []

    def fail_to_start(command, **kwargs):
        attempted_commands.append(command)
        raise FileNotFoundError("Docker unavailable")

    monkeypatch.setattr(
        workspace_service.subprocess,
        "Popen",
        fail_to_start,
    )

    result = workspace_service.run_pytest(
        workspace_root=tmp_path,
        test_path="test_sample.py",
    )

    assert result["exit_code"] is None
    assert result["timed_out"] is False
    assert "Could not start Docker" in result["stderr"]

    # The attempted execution must be Docker, never host Python.
    assert len(attempted_commands) == 1
    assert attempted_commands[0][0] == "docker"
    assert attempted_commands[0][1] == "run"

import io
import pytest


def test_workspace_rejects_path_traversal(tmp_path: Path):
    with pytest.raises(ValueError, match="Unsafe workspace path"):
        workspace_service._safe_file(tmp_path, "../outside.py")


def test_workspace_rejects_symlink_escape(tmp_path: Path):
    outside = tmp_path.parent / "outside.py"
    outside.write_text("print('outside')", encoding="utf-8")

    link = tmp_path / "linked.py"

    try:
        link.symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("Symlink creation is unavailable on this system")

    with pytest.raises(ValueError, match="Path escapes workspace"):
        workspace_service._safe_file(tmp_path, "linked.py")


def test_run_pytest_rejects_test_path_outside_workspace(
    tmp_path: Path,
    monkeypatch,
):
    def unexpected_docker_call(*args, **kwargs):
        pytest.fail("Docker must not run for an unsafe test path")

    monkeypatch.setattr(
        workspace_service.subprocess,
        "Popen",
        unexpected_docker_call,
    )

    with pytest.raises(ValueError, match="Unsafe workspace path"):
        workspace_service.run_pytest(
            workspace_root=tmp_path,
            test_path="../outside.py",
        )


def test_output_capture_is_bounded():
    output = workspace_service._new_output_buffer()

    stream = io.BytesIO(
        b"A" * (workspace_service.MAX_OUTPUT_BYTES + 1024)
    )

    workspace_service._drain_limited(stream, output)
    decoded = workspace_service._decode_output(output)

    assert output["truncated"] is True
    assert len(decoded.split("\n[Output truncated")[0]) == (
        workspace_service.MAX_OUTPUT_BYTES
    )
    assert "[Output truncated at 64 KiB]" in decoded


def test_docker_command_enforces_sandbox_restrictions(tmp_path: Path):
    command = workspace_service._build_docker_command(
        workspace_root=tmp_path,
        test_path="test_sample.py",
        container_name="proofloop-test-security",
    )

    assert "--network" in command
    assert command[command.index("--network") + 1] == "none"

    assert "--read-only" in command
    assert "--cap-drop=ALL" in command
    assert "--security-opt=no-new-privileges:true" in command
    assert "--pids-limit=64" in command
    assert "--memory=512m" in command
    assert "--cpus=1" in command
    assert "--user=65534:65534" in command

    mount = command[command.index("--mount") + 1]
    assert "target=/workspace,readonly" in mount


def test_safe_file_rejects_internal_symlink(tmp_path: Path):
    target = tmp_path / "actual.py"
    target.write_text("VALUE = 1\n", encoding="utf-8")

    link = tmp_path / "linked.py"

    try:
        link.symlink_to(target)
    except (OSError, NotImplementedError):
        pytest.skip("Symlink creation is unavailable")

    with pytest.raises(ValueError, match="Path escapes workspace"):
        workspace_service._safe_file(tmp_path, "linked.py")


def test_create_repository_workspace_copies_manifest_files(
    tmp_path: Path,
):
    from backend.app.services.workspace_service import (
        create_repository_workspace,
    )

    (tmp_path / "src").mkdir()
    (tmp_path / "tests").mkdir()

    source = tmp_path / "src" / "app.py"
    test_file = tmp_path / "tests" / "test_app.py"
    readme = tmp_path / "README.md"

    source.write_text("VALUE = 10\n", encoding="utf-8")
    test_file.write_text("def test_app():\n    assert True\n", encoding="utf-8")
    readme.write_text("Documentation", encoding="utf-8")

    manifest = RepositoryManifest(
        source_files=["src/app.py"],
        test_files=["tests/test_app.py"],
        config_files=[],
        total_files=2,
        total_bytes=source.stat().st_size + test_file.stat().st_size,
    )

    workspace = create_repository_workspace(tmp_path, manifest)

    try:
        workspace_root = Path(workspace.name)

        assert (workspace_root / "src/app.py").read_text(
            encoding="utf-8"
        ) == "VALUE = 10\n"

        assert (workspace_root / "tests/test_app.py").is_file()
        assert not (workspace_root / "README.md").exists()

        # Original project must remain unchanged.
        assert source.read_text(encoding="utf-8") == "VALUE = 10\n"

    finally:
        workspace.cleanup()


def test_create_repository_workspace_rejects_empty_manifest(
    tmp_path: Path,
):
    from backend.app.services.workspace_service import (
        create_repository_workspace,
    )

    manifest = RepositoryManifest(
        total_files=0,
        total_bytes=0,
    )

    with pytest.raises(ValueError, match="no approved files"):
        create_repository_workspace(tmp_path, manifest)


def test_create_repository_workspace_rejects_symlinked_source(
    tmp_path: Path,
):
    from backend.app.services.workspace_service import (
        create_repository_workspace,
    )

    outside = tmp_path.parent / "outside_repository.py"
    outside.write_text("SECRET = True\n", encoding="utf-8")

    link = tmp_path / "linked.py"

    try:
        link.symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("Symlink creation is unavailable")

    manifest = RepositoryManifest(
        source_files=["linked.py"],
        total_files=1,
        total_bytes=outside.stat().st_size,
    )

    with pytest.raises(ValueError, match="Path escapes workspace"):
        create_repository_workspace(tmp_path, manifest)

        
def test_docker_command_supports_multiple_test_targets(tmp_path: Path):
    command = workspace_service._build_docker_command(
        workspace_root=tmp_path,
        test_path=[
            "tests/test_auth.py",
            "tests/test_billing.py",
        ],
        container_name="proofloop-multiple-tests",
    )

    assert command[-2:] == [
        "tests/test_auth.py",
        "tests/test_billing.py",
    ]

    assert command[command.index("--network") + 1] == "none"
    assert "--read-only" in command


def test_run_pytest_accepts_multiple_test_files(
    tmp_path: Path,
    monkeypatch,
):
    (tmp_path / "tests").mkdir()

    (tmp_path / "tests" / "test_auth.py").write_text(
        "def test_auth():\n    assert True\n",
        encoding="utf-8",
    )

    (tmp_path / "tests" / "test_billing.py").write_text(
        "def test_billing():\n    assert True\n",
        encoding="utf-8",
    )

    attempted_commands = []

    def fake_popen(command, **kwargs):
        attempted_commands.append(command)
        raise FileNotFoundError("Docker unavailable")

    monkeypatch.setattr(
        workspace_service.subprocess,
        "Popen",
        fake_popen,
    )

    result = workspace_service.run_pytest(
        workspace_root=tmp_path,
        test_path=[
            "tests/test_auth.py",
            "tests/test_billing.py",
        ],
    )

    assert result["execution_started"] is False
    assert result["exit_code"] is None

    command = attempted_commands[0]

    assert command[-2:] == [
        "tests/test_auth.py",
        "tests/test_billing.py",
    ]


def test_run_pytest_rejects_empty_test_targets(tmp_path: Path):
    with pytest.raises(ValueError, match="At least one"):
        workspace_service.run_pytest(
            workspace_root=tmp_path,
            test_path=[],
        )


def test_run_pytest_rejects_duplicate_test_targets(
    tmp_path: Path,
):
    test_file = tmp_path / "test_sample.py"
    test_file.write_text(
        "def test_sample():\n    assert True\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="Duplicate"):
        workspace_service.run_pytest(
            workspace_root=tmp_path,
            test_path=[
                "test_sample.py",
                "test_sample.py",
            ],
        )


def test_run_pytest_rejects_missing_file_in_test_targets(
    tmp_path: Path,
    monkeypatch,
):
    existing = tmp_path / "test_existing.py"
    existing.write_text(
        "def test_existing():\n    assert True\n",
        encoding="utf-8",
    )

    def unexpected_docker_call(*args, **kwargs):
        pytest.fail("Docker must not start when a test target is missing")

    monkeypatch.setattr(
        workspace_service.subprocess,
        "Popen",
        unexpected_docker_call,
    )

    with pytest.raises(ValueError, match="does not exist"):
        workspace_service.run_pytest(
            workspace_root=tmp_path,
            test_path=[
                "test_existing.py",
                "test_missing.py",
            ],
        )
