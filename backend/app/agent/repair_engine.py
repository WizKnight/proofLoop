import difflib
import hashlib
from pathlib import Path
from typing import Any

from backend.app.schemas.patch import PatchProposal
from backend.app.services.meta_client import generate_patch_proposal
from backend.app.services.workspace_service import (
    apply_edit,
    create_workspace,
    run_pytest,
)

from backend.app.schemas.execution import ExecutionResult
from backend.app.services.meta_client import (
    generate_patch_proposal,
    generate_repository_patch_proposal,
)
from backend.app.services.repository_service import prepare_repository
from backend.app.services.workspace_service import create_repository_workspace

def _read_text(root: Path, relative_path: str) -> str:
    path = root / relative_path
    return path.read_text(encoding="utf-8")


def _diff(path: str, before: str, after: str) -> str:
    return "".join(
        difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=f"original/{path}",
            tofile=f"patched/{path}",
        )
    )

def _sha256_text(content: str) -> str:
    """Return a stable fingerprint of source text."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

def repair_project(
    *,
    project_root: Path,
    bug_report: str,
    source_path: str = "fixtures/buggy_example.py",
    test_path: str = "fixtures/test_buggy_example.py",
    expected_failure: str = "test_full_discount",
) -> dict[str, Any]:
    """Attempt one repair and report only evidence-supported outcomes."""
    project_root = project_root.resolve()
    allowed_paths = {source_path}
    workspace_files = [
        "fixtures/__init__.py",
        source_path,
        test_path,
    ]
    ledger: list[dict[str, Any]] = []

    def result(
        status: str,
        summary: str,
        **extra: Any,
    ) -> dict[str, Any]:
        return {
            "status": status,
            "summary": summary,
            "evidence": ledger,
            **extra,
        }

    # Step 1: Establish the baseline in a disposable copy.
    try:
        baseline_workspace = create_workspace(
            project_root,
            workspace_files,
        )
    except Exception as exc:
        return result(
            "unverified",
            "Could not create the baseline workspace.",
            error=f"{type(exc).__name__}: {exc}",
        )

    try:
        baseline_root = Path(baseline_workspace.name)
        baseline_source = _read_text(baseline_root, source_path)
        baseline = run_pytest(baseline_root, test_path)
        baseline = ExecutionResult.model_validate(baseline).model_dump(
            mode="json"
        )
    except Exception as exc:
        return result(
            "unverified",
            "Baseline execution could not be completed.",
            error=f"{type(exc).__name__}: {exc}",
        )
    finally:
        baseline_workspace.cleanup()

    baseline_output = baseline["stdout"] + "\n" + baseline["stderr"]
    reproduced = (
        not baseline["timed_out"]
        and baseline["exit_code"] != 0
        and expected_failure in baseline_output
    )

    ledger.append(
        {
            "step": "baseline_tests",
            **baseline,
            "expected_failure": expected_failure,
            "failure_reproduced": reproduced,
            "source_path": source_path,
            "source_sha256": _sha256_text(baseline_source),
        }
    )

    if not reproduced:
        return result(
            "unverified",
            "The expected baseline failure was not reproduced.",
        )

    # Step 2: Ask Meta for a structured patch proposal.
    try:
        proposal: PatchProposal = generate_patch_proposal(
            bug_report=bug_report,
            source_path=source_path,
            source_code=baseline_source,
            test_output=baseline_output,
        )
    except Exception as exc:
        ledger.append(
            {
                "step": "patch_generation",
                "success": False,
                "error_type": type(exc).__name__,
            }
        )
        return result(
            "unverified",
            "A valid patch proposal could not be generated.",
            error=f"{type(exc).__name__}: {exc}",
        )

    ledger.append(
        {
            "step": "patch_generation",
            "success": True,
            "summary": proposal.summary,
            "edits": [
                edit.model_dump()
                for edit in proposal.edits
            ],
        }
    )

    # Step 3: Apply the proposal in a NEW disposable workspace.
    try:
        patched_workspace = create_workspace(
            project_root,
            workspace_files,
        )
    except Exception as exc:
        return result(
            "unverified",
            "Could not create the patch workspace.",
            error=f"{type(exc).__name__}: {exc}",
        )

    try:
        patched_root = Path(patched_workspace.name)

        for edit in proposal.edits:
            apply_edit(
                patched_root,
                edit,
                allowed_paths=allowed_paths,
            )

        patched_source = _read_text(patched_root, source_path)
        patch_diff = _diff(source_path, baseline_source, patched_source)

        if not patch_diff or patched_source == baseline_source:
            raise ValueError("Patch did not change the source")

        if _sha256_text(patched_source) == _sha256_text(baseline_source):
            raise ValueError("Source fingerprint did not change")

        ledger.append(
            {
                "step": "patch_application",
                "success": True,
                "source_path": source_path,
                "source_sha256_before": _sha256_text(baseline_source),
                "source_sha256_after": _sha256_text(patched_source),
                "diff": patch_diff,
            }
        )

        # Step 4: Run the full regression suite against the patch.
        post_patch = run_pytest(patched_root, test_path)
        post_patch = ExecutionResult.model_validate(
            post_patch
        ).model_dump(mode="json")

        tests_passed = (
            post_patch["exit_code"] == 0
            and not post_patch["timed_out"]
        )

        ledger.append(
            {
                "step": "post_patch_tests",
                **post_patch,
                "tests_passed": tests_passed,
            }
        )

        verification_requirements_met = (
            reproduced
            and bool(patch_diff)
            and patched_source != baseline_source
            and tests_passed
        )

        if verification_requirements_met:
            return result(
                "verified",
                "The baseline failure was reproduced, the source changed, "
                "and the regression suite passed after the patch.",
                patch_summary=proposal.summary,
                diff=patch_diff,
                verification_scope=(
                    "The supplied regression suite passed. "
                    "This does not prove the absence of all bugs."
                ),
            )

        return result(
            "unverified",
            "The proposed patch did not pass the regression suite.",
            patch_summary=proposal.summary,
            diff=patch_diff,
        )

    except Exception as exc:
        ledger.append(
            {
                "step": "patch_or_test_execution",
                "success": False,
                "error_type": type(exc).__name__,
            }
        )
        return result(
            "unverified",
            "The patch could not be safely applied or tested.",
            error=f"{type(exc).__name__}: {exc}",
        )
    finally:
        patched_workspace.cleanup()

def repair_repository(
    *,
    project_root: Path,
    bug_report: str,
    expected_failure: str,
) -> dict[str, Any]:
    """
    Attempt a repair across an analyzed Python repository.

    A repair is verified only when:
    - The expected baseline failure is reproduced in Docker.
    - Meta proposes edits to approved source files.
    - Every edit is safely applied to a disposable workspace.
    - At least one source file changes.
    - The complete supplied regression suite passes in Docker.
    """
    project_root = Path(project_root).resolve()
    ledger: list[dict[str, Any]] = []

    def result(
        status: str,
        summary: str,
        **extra: Any,
    ) -> dict[str, Any]:
        return {
            "status": status,
            "summary": summary,
            "evidence": ledger,
            **extra,
        }

    if not bug_report.strip():
        return result(
            "unverified",
            "A bug report is required.",
        )

    if not expected_failure.strip():
        return result(
            "unverified",
            "An expected failure marker is required.",
        )

    # Step 1: Analyze the repository, create an isolated workspace,
    # and execute the complete baseline test suite.
    try:
        preparation = prepare_repository(project_root)
    except Exception as exc:
        return result(
            "unverified",
            "Repository analysis or baseline preparation failed.",
            error=f"{type(exc).__name__}: {exc}",
        )

    try:
        manifest = preparation.manifest
        baseline_root = preparation.workspace_root

        baseline = ExecutionResult.model_validate(
            preparation.baseline_execution
        ).model_dump(mode="json")

        baseline_output = (
            baseline["stdout"] + "\n" + baseline["stderr"]
        )

        reproduced = (
            baseline["execution_started"]
            and not baseline["timed_out"]
            and baseline["exit_code"] != 0
            and expected_failure in baseline_output
        )

        ledger.append(
            {
                "step": "baseline_tests",
                **baseline,
                "expected_failure": expected_failure,
                "failure_reproduced": reproduced,
                "test_targets": preparation.test_targets,
                "source_files": manifest.source_files,
                "source_file_hashes": {
                    path: _sha256_text(
                        _read_text(baseline_root, path)
                    )
                    for path in manifest.source_files
                },
            }
        )

        if not reproduced:
            return result(
                "unverified",
                "The expected baseline failure was not reproduced.",
            )

        # Step 2: Collect the approved source context.
        source_files = {
            path: _read_text(baseline_root, path)
            for path in manifest.source_files
        }

        allowed_paths = set(manifest.source_files)

        # Step 3: Ask Meta to diagnose the repository and propose
        # a structured multi-file patch.
        try:
            proposal: PatchProposal = generate_repository_patch_proposal(
                bug_report=bug_report,
                source_files=source_files,
                test_output=baseline_output,
                allowed_paths=allowed_paths,
            )
        except Exception as exc:
            ledger.append(
                {
                    "step": "patch_generation",
                    "success": False,
                    "error_type": type(exc).__name__,
                }
            )
            return result(
                "unverified",
                "A valid repository patch proposal could not be generated.",
                error=f"{type(exc).__name__}: {exc}",
            )

        ledger.append(
            {
                "step": "patch_generation",
                "success": True,
                "root_cause": proposal.root_cause,
                "diagnosis_evidence": proposal.diagnosis_evidence,
                "summary": proposal.summary,
                "edits": [
                    edit.model_dump()
                    for edit in proposal.edits
                ],
            }
        )

        # Step 4: Create a second workspace from the exact baseline
        # snapshot. Never patch the original repository.
        try:
            patched_workspace = create_repository_workspace(
                baseline_root,
                manifest,
            )
        except Exception as exc:
            return result(
                "unverified",
                "Could not create the isolated patch workspace.",
                error=f"{type(exc).__name__}: {exc}",
            )

        try:
            patched_root = Path(patched_workspace.name)

            for edit in proposal.edits:
                apply_edit(
                    patched_root,
                    edit,
                    allowed_paths=allowed_paths,
                )

            # Compare every source file against the baseline snapshot.
            changed_files: list[dict[str, str]] = []
            diffs: list[str] = []

            for path in sorted(allowed_paths):
                before = source_files[path]
                after = _read_text(patched_root, path)

                if before == after:
                    continue

                file_diff = _diff(path, before, after)

                if not file_diff:
                    raise ValueError(
                        f"Changed source has no corresponding diff: {path}"
                    )

                diffs.append(file_diff)
                changed_files.append(
                    {
                        "path": path,
                        "source_sha256_before": _sha256_text(before),
                        "source_sha256_after": _sha256_text(after),
                    }
                )

            if not changed_files:
                raise ValueError("Patch did not change any source files")

            patch_diff = "\n".join(diffs)

            # Preserve the existing evidence contract by identifying
            # one primary changed file in the required hash fields.
            primary_file = changed_files[0]
            primary_path = primary_file["path"]

            ledger[0]["source_path"] = primary_path
            ledger[0]["source_sha256"] = _sha256_text(
                source_files[primary_path]
            )

            ledger.append(
                {
                    "step": "patch_application",
                    "success": True,
                    "source_path": primary_path,
                    "source_sha256": primary_file["source_sha256_before"],
                    "source_sha256_before": primary_file["source_sha256_before"],
                    "source_sha256_after": primary_file["source_sha256_after"],
                    "changed_files": changed_files,
                    "diff": patch_diff,
                }
            )

            # Step 5: Execute every discovered test target again.
            post_patch = run_pytest(
                patched_root,
                preparation.test_targets,
            )

            post_patch = ExecutionResult.model_validate(
                post_patch
            ).model_dump(mode="json")

            tests_passed = (
                post_patch["execution_started"]
                and post_patch["exit_code"] == 0
                and not post_patch["timed_out"]
            )

            ledger.append(
                {
                    "step": "post_patch_tests",
                    **post_patch,
                    "tests_passed": tests_passed,
                    "test_targets": preparation.test_targets,
                }
            )

            # Step 6: Determine the outcome from execution evidence.
            verification_requirements_met = (
                reproduced
                and bool(patch_diff)
                and bool(changed_files)
                and tests_passed
            )

            if verification_requirements_met:
                return result(
                    "verified",
                    (
                        "The expected baseline failure was reproduced, "
                        "the repository source changed, and the complete "
                        "regression suite passed after the patch."
                    ),
                    patch_summary=proposal.summary,
                    root_cause=proposal.root_cause,
                    diff=patch_diff,
                    changed_files=changed_files,
                    verification_scope=(
                        "All discovered test targets in the analyzed "
                        "repository passed in the Docker sandbox. "
                        "This does not prove the absence of all bugs."
                    ),
                )

            return result(
                "unverified",
                "The proposed repository patch did not pass verification.",
                patch_summary=proposal.summary,
                diff=patch_diff,
                changed_files=changed_files,
            )

        except Exception as exc:
            ledger.append(
                {
                    "step": "patch_or_test_execution",
                    "success": False,
                    "error_type": type(exc).__name__,
                }
            )
            return result(
                "unverified",
                "The repository patch could not be safely applied or tested.",
                error=f"{type(exc).__name__}: {exc}",
            )
        finally:
            patched_workspace.cleanup()

    finally:
        preparation.cleanup()