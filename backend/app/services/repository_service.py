
from dataclasses import dataclass
from pathlib import Path
import tempfile

from backend.app.schemas.execution import ExecutionResult
from backend.app.schemas.repository import RepositoryManifest
from backend.app.services.repository_analyzer import analyze_repository
from backend.app.services.workspace_service import (
    create_repository_workspace,
    run_pytest,
)


@dataclass
class RepositoryPreparation:
    """Prepared repository and its baseline execution evidence."""

    manifest: RepositoryManifest
    workspace: tempfile.TemporaryDirectory[str]
    test_targets: list[str]
    baseline_execution: ExecutionResult

    @property
    def workspace_root(self) -> Path:
        return Path(self.workspace.name)

    def cleanup(self) -> None:
        """Remove the disposable repository workspace."""
        self.workspace.cleanup()


def prepare_repository(
    project_root: Path,
    *,
    timeout_seconds: int = 30,
) -> RepositoryPreparation:
    """
    Analyze a Python repository, create an isolated workspace,
    and execute its discovered pytest suite in Docker.

    The caller owns the returned workspace and must call cleanup().
    """
    manifest = analyze_repository(project_root)

    if not manifest.source_files:
        raise ValueError("Repository contains no Python source files")

    test_targets = [
        path
        for path in manifest.test_files
        if Path(path).name != "conftest.py"
    ]

    if not test_targets:
        raise ValueError("Repository contains no discoverable pytest test files")

    workspace = create_repository_workspace(
        project_root,
        manifest,
    )

    try:
        execution_data = run_pytest(
            workspace_root=Path(workspace.name),
            test_path=test_targets,
            timeout_seconds=timeout_seconds,
        )

        execution = ExecutionResult.model_validate(execution_data)

        return RepositoryPreparation(
            manifest=manifest,
            workspace=workspace,
            test_targets=test_targets,
            baseline_execution=execution,
        )

    except Exception:
        workspace.cleanup()
        raise
