from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = PROJECT_ROOT / "backend" / "sandbox" / "Dockerfile"
IMAGE_NAME = "proofloop-sandbox:local"

COMMAND_TIMEOUT_SECONDS = 300


def run_command(
    command: list[str],
    *,
    cwd: Path | None = None,
    timeout: int = COMMAND_TIMEOUT_SECONDS,
) -> subprocess.CompletedProcess[str]:
    """Run a command and report useful diagnostic output."""
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Docker CLI was not found. Install Docker Desktop or Docker Engine "
            "and make sure the docker command is available in PATH."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"Command timed out after {timeout} seconds: {command[0]}"
        ) from exc

    if result.returncode != 0:
        details = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(
            f"Command failed ({result.returncode}): "
            f"{' '.join(command)}\n{details}"
        )

    return result


def check_docker() -> None:
    """Verify that Docker CLI and daemon are available."""
    print("Checking Docker installation...")
    run_command(["docker", "--version"], timeout=15)

    print("Checking Docker daemon...")
    run_command(["docker", "info"], timeout=30)


def image_exists() -> bool:
    """Check whether the sandbox image is already available."""
    result = subprocess.run(
        ["docker", "image", "inspect", IMAGE_NAME],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    return result.returncode == 0


def build_image() -> None:
    """Build the sandbox image from the trusted project Dockerfile."""
    if not DOCKERFILE.is_file():
        raise RuntimeError(
            f"Sandbox Dockerfile was not found: {DOCKERFILE}"
        )

    print(f"Building {IMAGE_NAME}...")
    run_command(
        [
            "docker",
            "build",
            "--tag",
            IMAGE_NAME,
            "--file",
            str(DOCKERFILE),
            ".",
        ],
        cwd=PROJECT_ROOT,
    )


def smoke_test_image() -> None:
    """Verify non-root execution and read-only workspace access."""
    print("Running sandbox smoke test...")

    with tempfile.TemporaryDirectory(
        prefix="proofloop-docker-check-"
    ) as temporary_directory:
        workspace = Path(temporary_directory)
        test_file = workspace / "proofloop_smoke_test.txt"
        test_file.write_text("proofloop-sandbox-ok", encoding="utf-8")

        # Docker runs as UID 65534 on Linux. Make the temporary
        # workspace traversable and the test file readable.
        if os.name == "posix":
            os.chmod(workspace, 0o755)
            os.chmod(test_file, 0o644)

        verification_code = (
            "from pathlib import Path; "
            "import os; "
            "p = Path('/workspace/proofloop_smoke_test.txt'); "
            "assert p.read_text() == 'proofloop-sandbox-ok'; "
            "assert os.getuid() != 0; "
            "print('Sandbox smoke test passed')"
        )

        command = [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",
            "--read-only",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges:true",
            "--pids-limit=64",
            "--memory=128m",
            "--cpus=1",
            "--user=65534:65534",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=16m",
            "--mount",
            (
                "type=bind,"
                f"source={workspace},"
                "target=/workspace,readonly"
            ),
            "--workdir",
            "/workspace",
            IMAGE_NAME,
            "python",
            "-c",
            verification_code,
        ]

        result = run_command(command, cwd=PROJECT_ROOT, timeout=30)
        print(result.stdout.strip())


def main() -> int:
    try:
        check_docker()

        if image_exists():
            print(f"Found existing image: {IMAGE_NAME}")
        else:
            print(f"Image not found: {IMAGE_NAME}")
            build_image()

        run_command(
            ["docker", "image", "inspect", IMAGE_NAME],
            cwd=PROJECT_ROOT,
            timeout=30,
        )

        smoke_test_image()

        print("\nProofLoop Docker sandbox is ready.")
        return 0

    except RuntimeError as exc:
        print(f"\nDocker setup failed:\n{exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
