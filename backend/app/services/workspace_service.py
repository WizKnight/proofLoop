import shutil
import subprocess
import tempfile
import threading
import uuid
from pathlib import Path, PurePosixPath
from typing import Any

from backend.app.schemas.execution import ExecutionResult
from backend.app.schemas.patch import FileEdit


SANDBOX_IMAGE = "proofloop-sandbox:local"
MAX_OUTPUT_BYTES = 64 * 1024
OUTPUT_CHUNK_SIZE = 8192
STREAM_JOIN_TIMEOUT_SECONDS = 5
DOCKER_CLEANUP_TIMEOUT_SECONDS = 10


def _drain_limited(stream: Any, output: dict[str, Any]) -> None:
    """Drain a subprocess stream while retaining bounded output."""
    captured_bytes = 0

    while True:
        chunk = stream.read(OUTPUT_CHUNK_SIZE)

        if not chunk:
            break

        remaining_bytes = MAX_OUTPUT_BYTES - captured_bytes

        if remaining_bytes > 0:
            retained = chunk[:remaining_bytes]
            output["chunks"].append(retained)
            captured_bytes += len(retained)

        if len(chunk) > remaining_bytes:
            output["truncated"] = True


def _decode_output(output: dict[str, Any]) -> str:
    """Decode captured output and indicate when it was truncated."""
    text = b"".join(output["chunks"]).decode(
        "utf-8",
        errors="replace",
    )

    if output["truncated"]:
        text += f"\n[Output truncated at {MAX_OUTPUT_BYTES // 1024} KiB]"

    return text


def _new_output_buffer() -> dict[str, Any]:
    """Create an independent bounded output buffer."""
    return {
        "chunks": [],
        "truncated": False,
    }


def _safe_file(root: Path, relative_path: str) -> Path:
    """Resolve a relative file path and ensure it stays inside root."""
    relative = PurePosixPath(relative_path)

    if (
        relative.is_absolute()
        or ".." in relative.parts
        or "\\" in relative_path
        or not relative.parts
        or relative_path in ("", ".")
    ):
        raise ValueError("Unsafe workspace path")

    root_resolved = root.resolve()
    candidate = root_resolved.joinpath(*relative.parts)

    if not candidate.resolve().is_relative_to(root_resolved):
        raise ValueError("Path escapes workspace")

    return candidate


def create_workspace(
    source_root: Path,
    relative_paths: list[str],
) -> tempfile.TemporaryDirectory[str]:
    """Create a disposable workspace containing only approved files."""
    source_root = source_root.resolve()
    workspace = tempfile.TemporaryDirectory(prefix="proofloop-")
    destination_root = Path(workspace.name)

    try:
        for relative_path in relative_paths:
            source = _safe_file(source_root, relative_path)

            if source.is_symlink() or not source.is_file():
                raise ValueError(
                    f"Approved source must be a regular file: {relative_path}"
                )

            destination = _safe_file(
                destination_root,
                relative_path,
            )

            destination.parent.mkdir(
                parents=True,
                exist_ok=True,
            )

            shutil.copyfile(source, destination)

        return workspace

    except Exception:
        workspace.cleanup()
        raise


def apply_edit(
    workspace_root: Path,
    edit: FileEdit,
    allowed_paths: set[str],
) -> None:
    """Apply one exact-text edit to an approved workspace file."""
    if edit.path not in allowed_paths:
        raise ValueError(
            "Patch targets a file not approved for this run"
        )

    target = _safe_file(workspace_root, edit.path)

    if target.is_symlink() or not target.is_file():
        raise ValueError(
            "Patch target must be an existing regular file"
        )

    original = target.read_text(encoding="utf-8")
    occurrences = original.count(edit.old_text)

    if occurrences != 1:
        raise ValueError(
            f"Expected exactly one match for patch in {edit.path}; "
            f"found {occurrences}"
        )

    updated = original.replace(
        edit.old_text,
        edit.new_text,
        1,
    )

    # Write only after all patch checks have passed.
    target.write_text(
        updated,
        encoding="utf-8",
        newline="",
    )


def _build_docker_command(
    workspace_root: Path,
    test_path: str,
    container_name: str,
) -> list[str]:
    """Build the restricted Docker test command."""
    return [
        "docker",
        "run",
        "--name",
        container_name,
        "--rm",
        "--network",
        "none",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges:true",
        "--pids-limit=64",
        "--memory=512m",
        "--cpus=1",
        "--user=65534:65534",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=64m",
        "--mount",
        (
            "type=bind,"
            f"source={workspace_root},"
            "target=/workspace,readonly"
        ),
        "--workdir",
        "/workspace",
        "--env",
        "PYTHONDONTWRITEBYTECODE=1",
        "--env",
        "PYTEST_DISABLE_PLUGIN_AUTOLOAD=1",
        SANDBOX_IMAGE,
        "python",
        "-m",
        "pytest",
        "-q",
        "-p",
        "no:cacheprovider",
        test_path,
    ]


def _redact_command(
    command: list[str],
    workspace_root: Path,
) -> list[str]:
    """Remove the host workspace path from recorded commands."""
    root = str(workspace_root)

    return [
        argument.replace(root, "<workspace>")
        for argument in command
    ]


def _stop_container(container_name: str) -> None:
    """Force-remove a container after a Docker client timeout."""
    try:
        subprocess.run(
            ["docker", "rm", "-f", container_name],
            capture_output=True,
            timeout=DOCKER_CLEANUP_TIMEOUT_SECONDS,
            check=False,
        )
    except (subprocess.TimeoutExpired, OSError):
        pass


def _stop_process(process: subprocess.Popen) -> None:
    """Terminate the Docker client process and wait for its exit."""
    if process.poll() is not None:
        return

    process.kill()

    try:
        process.wait(timeout=STREAM_JOIN_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        pass


def _start_output_threads(
    process: subprocess.Popen,
    stdout_data: dict[str, Any],
    stderr_data: dict[str, Any],
) -> tuple[threading.Thread, threading.Thread]:
    """Start independent threads to drain stdout and stderr."""
    stdout_thread = threading.Thread(
        target=_drain_limited,
        args=(process.stdout, stdout_data),
        daemon=True,
    )

    stderr_thread = threading.Thread(
        target=_drain_limited,
        args=(process.stderr, stderr_data),
        daemon=True,
    )

    stdout_thread.start()
    stderr_thread.start()

    return stdout_thread, stderr_thread


def _join_output_threads(
    threads: tuple[threading.Thread, threading.Thread],
) -> None:
    """Wait briefly for output-draining threads to finish."""
    for thread in threads:
        thread.join(timeout=STREAM_JOIN_TIMEOUT_SECONDS)


def _build_execution_result(
    *,
    execution_id: uuid.UUID,
    command: list[str],
    workspace_root: Path,
    execution_started: bool,
    exit_code: int | None,
    stdout_data: dict[str, Any],
    stderr_data: dict[str, Any],
    timed_out: bool,
    startup_error: str | None = None,
) -> dict[str, Any]:
    """Build a validated and serializable execution result."""
    stderr = (
        f"Could not start Docker: {startup_error}"
        if startup_error is not None
        else _decode_output(stderr_data)
    )

    result = ExecutionResult(
        execution_id=execution_id,
        executor="docker",
        sandbox_image=SANDBOX_IMAGE,
        execution_started=execution_started,
        command=_redact_command(command, workspace_root),
        exit_code=exit_code,
        stdout=_decode_output(stdout_data),
        stderr=stderr,
        timed_out=timed_out,
    )

    return result.model_dump(mode="json")


def run_pytest(
    workspace_root: Path,
    test_path: str,
    timeout_seconds: int = 30,
) -> dict[str, Any]:
    """Run pytest inside a restricted Docker container."""
    if not 1 <= timeout_seconds <= 120:
        raise ValueError(
            "Timeout must be between 1 and 120 seconds"
        )

    workspace_root = workspace_root.resolve()
    test_file = _safe_file(workspace_root, test_path)

    if not test_file.is_file():
        raise ValueError(
            "Test file does not exist in the workspace"
        )

    execution_id = uuid.uuid4()
    container_name = (
        f"proofloop-test-{uuid.uuid4().hex[:12]}"
    )

    command = _build_docker_command(
        workspace_root,
        test_path,
        container_name,
    )

    stdout_data = _new_output_buffer()
    stderr_data = _new_output_buffer()

    process = None
    output_threads = None
    timed_out = False
    exit_code = None

    try:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        output_threads = _start_output_threads(
            process,
            stdout_data,
            stderr_data,
        )

        try:
            exit_code = process.wait(
                timeout=timeout_seconds,
            )

        except subprocess.TimeoutExpired:
            timed_out = True

            # Stop the container before terminating its Docker client.
            _stop_container(container_name)
            _stop_process(process)

        finally:
            _join_output_threads(output_threads)

        if not timed_out:
            exit_code = process.returncode

        return _build_execution_result(
            execution_id=execution_id,
            command=command,
            workspace_root=workspace_root,
            execution_started=True,
            exit_code=exit_code,
            stdout_data=stdout_data,
            stderr_data=stderr_data,
            timed_out=timed_out,
        )

    except OSError as exc:
        return _build_execution_result(
            execution_id=execution_id,
            command=command,
            workspace_root=workspace_root,
            execution_started=False,
            exit_code=None,
            stdout_data=stdout_data,
            stderr_data=stderr_data,
            timed_out=False,
            startup_error=str(exc),
        )

    finally:
        if process is not None:
            for stream in (process.stdout, process.stderr):
                if stream is not None:
                    stream.close()
