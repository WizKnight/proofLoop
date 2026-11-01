from pathlib import Path

from backend.app.services import workspace_service


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