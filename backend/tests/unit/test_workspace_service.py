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
