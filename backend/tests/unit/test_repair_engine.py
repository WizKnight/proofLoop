
from pathlib import Path

import pytest
from pydantic import ValidationError
import tempfile
from types import SimpleNamespace

from backend.app.schemas.repository import RepositoryManifest

from backend.app.agent import repair_engine
from backend.app.schemas.patch import FileEdit, PatchProposal
from backend.app.services.workspace_service import (
    apply_edit,
    create_workspace,
)


def make_edit(
    path: str = "buggy_example.py",
    old_text: str = "return price",
    new_text: str = "return 0",
) -> FileEdit:
    return FileEdit(
        path=path,
        old_text=old_text,
        new_text=new_text,
        explanation="Correct the full-discount boundary case",
    )


def test_patch_rejects_parent_directory_traversal():
    with pytest.raises(ValidationError):
        make_edit(path="../outside.py")


def test_patch_rejects_windows_absolute_path():
    with pytest.raises(ValidationError):
        make_edit(path=r"C:\outside.py")


def test_patch_rejects_duplicate_file_edits():
    edit = make_edit()

    with pytest.raises(ValidationError):
        PatchProposal(
            summary="Ambiguous patch",
            edits=[edit, edit],
        )


def test_apply_edit_requires_exactly_one_match(tmp_path: Path):
    target = tmp_path / "buggy_example.py"
    target.write_text("return price\nreturn price\n", encoding="utf-8")

    with pytest.raises(ValueError, match="exactly one match"):
        apply_edit(
            tmp_path,
            make_edit(),
            allowed_paths={"buggy_example.py"},
        )


def test_apply_edit_changes_only_workspace(tmp_path: Path):
    original = tmp_path / "original"
    original.mkdir()
    source_file = original / "buggy_example.py"
    source_file.write_text("return price\n", encoding="utf-8")

    workspace = create_workspace(
        original,
        ["buggy_example.py"],
    )

    try:
        workspace_root = Path(workspace.name)

        apply_edit(
            workspace_root,
            make_edit(),
            allowed_paths={"buggy_example.py"},
        )

        assert (
            workspace_root / "buggy_example.py"
        ).read_text(encoding="utf-8") == "return 0\n"

        assert source_file.read_text(encoding="utf-8") == "return price\n"
    finally:
        workspace.cleanup()


def test_apply_edit_rejects_unapproved_file(tmp_path: Path):
    target = tmp_path / "buggy_example.py"
    target.write_text("return price\n", encoding="utf-8")

    with pytest.raises(ValueError, match="not approved"):
        apply_edit(
            tmp_path,
            make_edit(),
            allowed_paths={"another_file.py"},
        )


def test_repair_engine_verifies_a_successful_patch(
    monkeypatch,
):
    def fake_proposal(**kwargs):
        return PatchProposal(
            summary="Fix the full-discount boundary condition.",
            edits=[
                FileEdit(
                    path="fixtures/buggy_example.py",
                    old_text="    if discount_percent == 100:\n        return price",
                    new_text="    if discount_percent == 100:\n        return 0",
                    explanation="A full discount must produce a zero price.",
                )
            ],
        )

    monkeypatch.setattr(
        repair_engine, "generate_patch_proposal", fake_proposal
    )

    project_root = Path(__file__).resolve().parents[3]

    report = repair_engine.repair_project(
        project_root=project_root,
        bug_report=(
            "calculate_discount returns the original price "
            "when discount_percent is 100."
        ),
    )

    assert report["status"] == "verified"
    assert any(
        item["step"] == "baseline_tests"
        and item["failure_reproduced"]
        for item in report["evidence"]
    )
    assert any(
        item["step"] == "post_patch_tests"
        and item["tests_passed"]
        for item in report["evidence"]
    )


def test_repair_engine_does_not_verify_a_failing_patch(
    monkeypatch,
):
    def fake_proposal(**kwargs):
        return PatchProposal(
            summary="Intentionally incorrect patch for testing.",
            edits=[
                FileEdit(
                    path="fixtures/buggy_example.py",
                    old_text="    if discount_percent == 100:\n        return price",
                    new_text="    if discount_percent == 100:\n        return 1",
                    explanation="Intentionally incorrect patch for testing.",
                )
            ],
        )
    

    monkeypatch.setattr(
        repair_engine, "generate_patch_proposal", fake_proposal
    )

    project_root = Path(__file__).resolve().parents[3]

    report = repair_engine.repair_project(
        project_root=project_root,
        bug_report="The full-discount boundary case is incorrect.",
    )
    

    assert report["status"] == "unverified"
    assert any(
        item["step"] == "post_patch_tests"
        and not item["tests_passed"]
        for item in report["evidence"]
    )


def test_repair_engine_refuses_unreproduced_baseline(
    monkeypatch,
):
    def unexpected_model_call(**kwargs):
        pytest.fail("Meta must not be called when baseline is unconfirmed")

    monkeypatch.setattr(
        repair_engine, "generate_patch_proposal", unexpected_model_call
    )
    monkeypatch.setattr(
        repair_engine,
        "run_pytest",
        lambda *args, **kwargs: {
            "execution_id": "00000000-0000-4000-8000-000000000003",
            "executor": "docker",
            "sandbox_image": "proofloop-sandbox:local",
            "execution_started": True,
            "command": [
                "docker",
                "run",
                "proofloop-sandbox:local",
                "python",
                "-m",
                "pytest",
            ],
            "exit_code": 0,
            "stdout": "5 passed",
            "stderr": "",
            "timed_out": False,
        },
    )

    project_root = Path(__file__).resolve().parents[3]

    report = repair_engine.repair_project(
        project_root=project_root,
        bug_report="Test baseline guard.",
    )

    assert report["status"] == "unverified"
    assert "not reproduced" in report["summary"]


def test_verified_report_contains_auditable_evidence(monkeypatch):
    def fake_proposal(**kwargs):
        return PatchProposal(
            summary="Fix the full-discount boundary condition.",
            edits=[
                FileEdit(
                    path="fixtures/buggy_example.py",
                    old_text=(
                        "    if discount_percent == 100:\n"
                        "        return price"
                    ),
                    new_text=(
                        "    if discount_percent == 100:\n"
                        "        return 0"
                    ),
                    explanation="A full discount must return zero.",
                )
            ],
        )

    monkeypatch.setattr(
        repair_engine, "generate_patch_proposal", fake_proposal
    )

    project_root = Path(__file__).resolve().parents[3]
    report = repair_engine.repair_project(
        project_root=project_root,
        bug_report="A 100% discount should return zero.",
    )

    assert report["status"] == "verified"

    evidence = report["evidence"]
    baseline = next(e for e in evidence if e["step"] == "baseline_tests")
    proposal = next(e for e in evidence if e["step"] == "patch_generation")
    application = next(e for e in evidence if e["step"] == "patch_application")
    post_patch = next(e for e in evidence if e["step"] == "post_patch_tests")

    assert baseline["failure_reproduced"] is True
    assert len(baseline["source_sha256"]) == 64
    assert proposal["edits"][0]["path"] == "fixtures/buggy_example.py"
    assert proposal["edits"][0]["old_text"]
    assert proposal["edits"][0]["new_text"]
    assert application["success"] is True
    assert application["source_sha256_before"] != application["source_sha256_after"]
    assert application["diff"]
    assert post_patch["exit_code"] == 0
    assert post_patch["timed_out"] is False
    assert post_patch["tests_passed"] is True


def make_execution_result(
    *,
    execution_id: str,
    exit_code: int | None,
    stdout: str = "",
    timed_out: bool = False,
) -> dict:
    return {
        "execution_id": execution_id,
        "executor": "docker",
        "sandbox_image": "proofloop-sandbox:local",
        "execution_started": True,
        "command": [
            "docker",
            "run",
            "proofloop-sandbox:local",
            "python",
            "-m",
            "pytest",
        ],
        "exit_code": exit_code,
        "stdout": stdout,
        "stderr": "",
        "timed_out": timed_out,
    }


def test_repair_engine_refuses_timed_out_baseline(monkeypatch):
    def unexpected_model_call(**kwargs):
        pytest.fail("Meta must not be called after a baseline timeout")

    monkeypatch.setattr(
        repair_engine,
        "generate_patch_proposal",
        unexpected_model_call,
    )

    monkeypatch.setattr(
        repair_engine,
        "run_pytest",
        lambda *args, **kwargs: make_execution_result(
            execution_id="00000000-0000-4000-8000-000000000010",
            exit_code=None,
            stdout="Execution timed out",
            timed_out=True,
        ),
    )

    project_root = Path(__file__).resolve().parents[3]

    report = repair_engine.repair_project(
        project_root=project_root,
        bug_report="Test baseline timeout handling.",
    )

    assert report["status"] == "unverified"
    assert "not reproduced" in report["summary"]

    baseline = next(
        item for item in report["evidence"]
        if item["step"] == "baseline_tests"
    )

    assert baseline["timed_out"] is True
    assert baseline["failure_reproduced"] is False


def test_repair_engine_does_not_verify_timed_out_post_patch_tests(
    monkeypatch,
):
    def fake_proposal(**kwargs):
        return PatchProposal(
            summary="Fix the full-discount boundary condition.",
            edits=[
                FileEdit(
                    path="fixtures/buggy_example.py",
                    old_text=(
                        "    if discount_percent == 100:\n"
                        "        return price"
                    ),
                    new_text=(
                        "    if discount_percent == 100:\n"
                        "        return 0"
                    ),
                    explanation="A full discount must return zero.",
                )
            ],
        )

    monkeypatch.setattr(
        repair_engine,
        "generate_patch_proposal",
        fake_proposal,
    )

    execution_results = [
        make_execution_result(
            execution_id="00000000-0000-4000-8000-000000000011",
            exit_code=1,
            stdout="FAILED test_full_discount",
        ),
        make_execution_result(
            execution_id="00000000-0000-4000-8000-000000000012",
            exit_code=None,
            stdout="Execution timed out",
            timed_out=True,
        ),
    ]

    def fake_run_pytest(*args, **kwargs):
        return execution_results.pop(0)

    monkeypatch.setattr(
        repair_engine,
        "run_pytest",
        fake_run_pytest,
    )

    project_root = Path(__file__).resolve().parents[3]

    report = repair_engine.repair_project(
        project_root=project_root,
        bug_report="A 100% discount should return zero.",
    )

    assert report["status"] == "unverified"

    post_patch = next(
        item for item in report["evidence"]
        if item["step"] == "post_patch_tests"
    )

    assert post_patch["timed_out"] is True
    assert post_patch["tests_passed"] is False
    assert post_patch["exit_code"] is None


def make_repository_preparation(
    tmp_path: Path,
    *,
    baseline_execution: dict | None = None,
    source_files: dict[str, str] | None = None,
):
    """Create a disposable repository fixture for repair_repository tests."""

    source_files = source_files or {
        "src/pricing.py": (
            "def calculate_total(price, discount):\n"
            "    return price\n"
        ),
        "src/formatting.py": (
            "def format_label():\n"
            "    return 'old'\n"
        ),
    }

    temporary_directory = tempfile.TemporaryDirectory(
        dir=tmp_path
    )
    repository_root = Path(temporary_directory.name)

    all_files = dict(source_files)
    all_files["tests/test_pricing.py"] = (
        "def test_full_discount():\n"
        "    assert True\n"
    )

    for relative_path, content in all_files.items():
        target = repository_root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    manifest = RepositoryManifest(
        source_files=sorted(source_files),
        test_files=["tests/test_pricing.py"],
        config_files=[],
        total_files=len(all_files),
        total_bytes=sum(
            len(content.encode("utf-8"))
            for content in all_files.values()
        ),
    )

    if baseline_execution is None:
        baseline_execution = make_execution_result(
            execution_id="00000000-0000-4000-8000-000000000101",
            exit_code=1,
            stdout="FAILED test_full_discount",
        )

    return SimpleNamespace(
        manifest=manifest,
        workspace_root=repository_root,
        baseline_execution=baseline_execution,
        test_targets=["tests/test_pricing.py"],
        cleanup=temporary_directory.cleanup,
    )


def test_repair_repository_verifies_multi_file_patch(
    monkeypatch,
    tmp_path: Path,
):
    """A successful multi-file patch must produce auditable evidence."""

    preparation = make_repository_preparation(tmp_path)

    monkeypatch.setattr(
        repair_engine,
        "prepare_repository",
        lambda *args, **kwargs: preparation,
    )

    def fake_proposal(**kwargs):
        assert "src/pricing.py" in kwargs["source_files"]
        assert "src/formatting.py" in kwargs["source_files"]

        return PatchProposal(
            root_cause="The pricing function ignores the discount.",
            diagnosis_evidence=["The baseline test reports a full-discount failure."],
            summary="Correct the pricing and formatting logic.",
            edits=[
                FileEdit(
                    path="src/pricing.py",
                    old_text="    return price",
                    new_text="    return 0",
                    explanation="A full discount must return zero.",
                ),
                FileEdit(
                    path="src/formatting.py",
                    old_text="    return 'old'",
                    new_text="    return 'updated'",
                    explanation="Update the related formatting output.",
                ),
            ],
        )

    monkeypatch.setattr(
        repair_engine,
        "generate_repository_patch_proposal",
        fake_proposal,
    )

    monkeypatch.setattr(
        repair_engine,
        "run_pytest",
        lambda *args, **kwargs: make_execution_result(
            execution_id="00000000-0000-4000-8000-000000000102",
            exit_code=0,
            stdout="2 passed",
        ),
    )

    try:
        report = repair_engine.repair_repository(
            project_root=tmp_path,
            bug_report="The full-discount calculation is incorrect.",
            expected_failure="FAILED test_full_discount",
        )

        assert report["status"] == "verified"

        baseline = next(
            item for item in report["evidence"]
            if item["step"] == "baseline_tests"
        )

        application = next(
            item for item in report["evidence"]
            if item["step"] == "patch_application"
        )

        post_patch = next(
            item for item in report["evidence"]
            if item["step"] == "post_patch_tests"
        )

        assert baseline["failure_reproduced"] is True
        assert len(application["changed_files"]) == 2
        assert application["diff"]
        assert application["source_sha256_before"] != (
            application["source_sha256_after"]
        )

        # The primary source hash must match across evidence steps.
        assert baseline["source_sha256"] == (
            application["source_sha256_before"]
        )

        assert post_patch["tests_passed"] is True
        assert (
            baseline["execution_id"]
            != post_patch["execution_id"]
        )

    finally:
        preparation.cleanup()


def test_repair_repository_refuses_unreproduced_baseline(
    monkeypatch,
    tmp_path: Path,
):
    """Meta must not be called when the expected failure is absent."""

    preparation = make_repository_preparation(
        tmp_path,
        baseline_execution=make_execution_result(
            execution_id="00000000-0000-4000-8000-000000000103",
            exit_code=0,
            stdout="2 passed",
        ),
    )

    monkeypatch.setattr(
        repair_engine,
        "prepare_repository",
        lambda *args, **kwargs: preparation,
    )

    def unexpected_model_call(**kwargs):
        pytest.fail(
            "Meta must not be called when the baseline failure is absent."
        )

    monkeypatch.setattr(
        repair_engine,
        "generate_repository_patch_proposal",
        unexpected_model_call,
    )

    try:
        report = repair_engine.repair_repository(
            project_root=tmp_path,
            bug_report="Test baseline reproduction guard.",
            expected_failure="FAILED test_full_discount",
        )

        assert report["status"] == "unverified"
        assert "not reproduced" in report["summary"]

        baseline = next(
            item for item in report["evidence"]
            if item["step"] == "baseline_tests"
        )

        assert baseline["failure_reproduced"] is False

    finally:
        preparation.cleanup()


def test_repair_repository_does_not_verify_post_patch_timeout(
    monkeypatch,
    tmp_path: Path,
):
    """A post-patch timeout must never produce verified status."""

    preparation = make_repository_preparation(tmp_path)

    monkeypatch.setattr(
        repair_engine,
        "prepare_repository",
        lambda *args, **kwargs: preparation,
    )

    def fake_proposal(**kwargs):
        return PatchProposal(
            root_cause="The pricing function ignores the discount.",
            diagnosis_evidence=["The baseline test reports a failure."],
            summary="Fix the full-discount calculation.",
            edits=[
                FileEdit(
                    path="src/pricing.py",
                    old_text="    return price",
                    new_text="    return 0",
                    explanation="A full discount must return zero.",
                ),
            ],
        )

    monkeypatch.setattr(
        repair_engine,
        "generate_repository_patch_proposal",
        fake_proposal,
    )

    monkeypatch.setattr(
        repair_engine,
        "run_pytest",
        lambda *args, **kwargs: make_execution_result(
            execution_id="00000000-0000-4000-8000-000000000104",
            exit_code=None,
            stdout="Execution timed out",
            timed_out=True,
        ),
    )

    try:
        report = repair_engine.repair_repository(
            project_root=tmp_path,
            bug_report="The full-discount calculation is incorrect.",
            expected_failure="FAILED test_full_discount",
        )

        assert report["status"] == "unverified"

        post_patch = next(
            item for item in report["evidence"]
            if item["step"] == "post_patch_tests"
        )

        assert post_patch["timed_out"] is True
        assert post_patch["tests_passed"] is False
        assert post_patch["exit_code"] is None

    finally:
        preparation.cleanup()


def test_repair_repository_handles_patch_generation_failure(
    monkeypatch,
    tmp_path: Path,
):
    preparation = make_repository_preparation(tmp_path)

    monkeypatch.setattr(
        repair_engine,
        "prepare_repository",
        lambda *args, **kwargs: preparation,
    )

    def failing_model_call(**kwargs):
        raise RuntimeError("Meta API unavailable")

    monkeypatch.setattr(
        repair_engine,
        "generate_repository_patch_proposal",
        failing_model_call,
    )

    try:
        report = repair_engine.repair_repository(
            project_root=tmp_path,
            bug_report="Fix the pricing calculation.",
            expected_failure="FAILED test_full_discount",
        )

        assert report["status"] == "unverified"
        assert "could not be generated" in report["summary"]

        proposal = next(
            item for item in report["evidence"]
            if item["step"] == "patch_generation"
        )

        assert proposal["success"] is False
        assert proposal["error_type"] == "RuntimeError"

    finally:
        preparation.cleanup()


def test_repair_repository_rejects_unapproved_file_edit(
    monkeypatch,
    tmp_path: Path,
):
    preparation = make_repository_preparation(tmp_path)

    monkeypatch.setattr(
        repair_engine,
        "prepare_repository",
        lambda *args, **kwargs: preparation,
    )

    def fake_proposal(**kwargs):
        return PatchProposal(
            summary="Attempt to modify a test file.",
            edits=[
                FileEdit(
                    path="tests/test_pricing.py",
                    old_text="    assert True",
                    new_text="    assert False",
                    explanation="Unapproved test modification.",
                ),
            ],
        )

    monkeypatch.setattr(
        repair_engine,
        "generate_repository_patch_proposal",
        fake_proposal,
    )

    try:
        report = repair_engine.repair_repository(
            project_root=tmp_path,
            bug_report="Fix the pricing calculation.",
            expected_failure="FAILED test_full_discount",
        )

        assert report["status"] == "unverified"

        failure = next(
            item for item in report["evidence"]
            if item["step"] == "patch_or_test_execution"
        )

        assert failure["success"] is False
        assert failure["error_type"] == "ValueError"

    finally:
        preparation.cleanup()


def test_repair_repository_handles_patch_application_failure(
    monkeypatch,
    tmp_path: Path,
):
    preparation = make_repository_preparation(tmp_path)

    monkeypatch.setattr(
        repair_engine,
        "prepare_repository",
        lambda *args, **kwargs: preparation,
    )

    monkeypatch.setattr(
        repair_engine,
        "generate_repository_patch_proposal",
        lambda **kwargs: PatchProposal(
            summary="Fix pricing calculation.",
            edits=[
                FileEdit(
                    path="src/pricing.py",
                    old_text="    return price",
                    new_text="    return 0",
                    explanation="Correct full discount.",
                ),
            ],
        ),
    )

    def failing_apply_edit(*args, **kwargs):
        raise ValueError("Simulated patch application failure")

    monkeypatch.setattr(
        repair_engine,
        "apply_edit",
        failing_apply_edit,
    )

    try:
        report = repair_engine.repair_repository(
            project_root=tmp_path,
            bug_report="Fix the pricing calculation.",
            expected_failure="FAILED test_full_discount",
        )

        assert report["status"] == "unverified"

        failure = next(
            item for item in report["evidence"]
            if item["step"] == "patch_or_test_execution"
        )

        assert failure["success"] is False
        assert failure["error_type"] == "ValueError"

    finally:
        preparation.cleanup()


def test_repair_repository_cleans_up_both_workspaces(
    monkeypatch,
    tmp_path: Path,
):
    preparation = make_repository_preparation(tmp_path)

    cleanup_state = {
        "baseline": False,
        "patched": False,
    }

    original_cleanup = preparation.cleanup

    def tracked_baseline_cleanup():
        cleanup_state["baseline"] = True
        original_cleanup()

    preparation.cleanup = tracked_baseline_cleanup

    class TrackedWorkspace:
        def __init__(self, directory: Path):
            self.name = str(directory)

        def cleanup(self):
            cleanup_state["patched"] = True

    patched_directory = tmp_path / "patched_workspace"
    patched_directory.mkdir()

    monkeypatch.setattr(
        repair_engine,
        "prepare_repository",
        lambda *args, **kwargs: preparation,
    )

    monkeypatch.setattr(
        repair_engine,
        "create_repository_workspace",
        lambda *args, **kwargs: TrackedWorkspace(
            patched_directory
        ),
    )

    monkeypatch.setattr(
        repair_engine,
        "generate_repository_patch_proposal",
        lambda **kwargs: PatchProposal(
            summary="Fix pricing calculation.",
            edits=[
                FileEdit(
                    path="src/pricing.py",
                    old_text="    return price",
                    new_text="    return 0",
                    explanation="Correct full discount.",
                ),
            ],
        ),
    )

    monkeypatch.setattr(
        repair_engine,
        "apply_edit",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            ValueError("Simulated failure")
        ),
    )

    report = repair_engine.repair_repository(
        project_root=tmp_path,
        bug_report="Fix the pricing calculation.",
        expected_failure="FAILED test_full_discount",
    )

    assert report["status"] == "unverified"
    assert cleanup_state["baseline"] is True
    assert cleanup_state["patched"] is True