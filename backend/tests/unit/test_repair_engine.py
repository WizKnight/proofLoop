
from pathlib import Path

import pytest
from pydantic import ValidationError

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