import pytest
from pydantic import ValidationError

from backend.app.schemas.evidence import RepairReport


def make_verified_report() -> dict:
    """Return a complete, internally consistent verified report."""
    diff = (
        "--- original/fixtures/buggy_example.py\n"
        "+++ patched/fixtures/buggy_example.py\n"
        "-        return price\n"
        "+        return 0\n"
    )

    return {
        "project": "ProofLoop",
        "timestamp_utc": "2026-10-29T12:00:00+00:00",
        "status": "verified",
        "summary": "Baseline failure reproduced and regression tests passed.",
        "evidence": [
            {
                "step": "baseline_tests",
                "expected_failure": "test_full_discount",
                "failure_reproduced": True,
                "source_path": "fixtures/buggy_example.py",
                "source_sha256": "a" * 64,
                "execution_id": "baseline-execution-001",
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
                "exit_code": 1,
                "timed_out": False,
            },
            {
                "step": "patch_generation",
                "success": True,
                "summary": "Fix full discount handling.",
                "edits": [],
            },
            {
                "step": "patch_application",
                "success": True,
                "source_path": "fixtures/buggy_example.py",
                "source_sha256_before": "a" * 64,
                "source_sha256_after": "b" * 64,
                "diff": diff,
            },
            {
                "step": "post_patch_tests",
                "tests_passed": True,
                "execution_id": "post-patch-execution-002",
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
                "timed_out": False,
            },
        ],
        "patch_summary": "Return zero for a full discount.",
        "diff": diff,
        "verification_scope": (
            "The supplied regression suite passed; "
            "this does not prove the absence of all bugs."
        ),
    }

import copy

def make_multi_file_verified_report() -> dict:
    """Return a verified report with consistent multi-file evidence."""
    data = make_verified_report()

    changed_files = [
        {
            "path": "fixtures/buggy_example.py",
            "source_sha256_before": "a" * 64,
            "source_sha256_after": "b" * 64,
        },
        {
            "path": "backend/app/services/example.py",
            "source_sha256_before": "c" * 64,
            "source_sha256_after": "d" * 64,
        },
    ]

    data["root_cause"] = (
        "The discount calculation did not handle a 100% discount."
    )
    data["changed_files"] = copy.deepcopy(changed_files)
    data["evidence"][2]["changed_files"] = copy.deepcopy(changed_files)

    return data


def test_valid_verified_report_is_accepted():
    report = RepairReport.model_validate(make_verified_report())

    assert report.status == "verified"
    assert len(report.evidence) == 4


def test_verified_report_requires_reproduced_baseline_failure():
    data = make_verified_report()
    data["evidence"][0]["failure_reproduced"] = False

    with pytest.raises(ValidationError, match="reproduced baseline failure"):
        RepairReport.model_validate(data)


def test_verified_report_rejects_failed_post_patch_tests():
    data = make_verified_report()
    data["evidence"][3]["exit_code"] = 1
    data["evidence"][3]["tests_passed"] = False

    with pytest.raises(ValidationError, match="successful post-patch Docker tests"):
        RepairReport.model_validate(data)


def test_verified_report_requires_patch_generation():
    data = make_verified_report()
    data["evidence"] = [
        entry for entry in data["evidence"]
        if entry["step"] != "patch_generation"
    ]

    with pytest.raises(ValidationError, match="successful patch proposal"):
        RepairReport.model_validate(data)


def test_verified_report_rejects_non_docker_baseline():
    data = make_verified_report()
    data["evidence"][0]["executor"] = "host"

    with pytest.raises(ValidationError, match="Docker test run"):
        RepairReport.model_validate(data)


def test_verified_report_rejects_non_docker_post_tests():
    data = make_verified_report()
    data["evidence"][3]["executor"] = "host"

    with pytest.raises(ValidationError, match="successful post-patch Docker tests"):
        RepairReport.model_validate(data)


def test_verified_report_rejects_inconsistent_source_hashes():
    data = make_verified_report()
    data["evidence"][0]["source_sha256"] = "c" * 64

    with pytest.raises(ValidationError, match="original source hash"):
        RepairReport.model_validate(data)


def test_verified_report_rejects_inconsistent_diffs():
    data = make_verified_report()
    data["diff"] += "# unexpected change\n"

    with pytest.raises(ValidationError, match="Top-level diff"):
        RepairReport.model_validate(data)


def test_unverified_report_can_have_incomplete_evidence():
    data = {
        "project": "ProofLoop",
        "timestamp_utc": "2026-10-29T12:00:00+00:00",
        "status": "unverified",
        "summary": "The baseline failure could not be reproduced.",
        "evidence": [],
    }

    report = RepairReport.model_validate(data)

    assert report.status == "unverified"
    assert report.evidence == []


def test_valid_multi_file_verified_report_is_accepted():
    data = make_multi_file_verified_report()

    report = RepairReport.model_validate(data)

    assert report.status == "verified"
    assert len(report.changed_files) == 2
    assert report.root_cause is not None


def test_multi_file_report_requires_evidence_on_both_sides():
    data = make_multi_file_verified_report()
    data["evidence"][2].pop("changed_files")

    with pytest.raises(
        ValidationError,
        match="both contain multi-file change evidence",
    ):
        RepairReport.model_validate(data)


def test_multi_file_report_rejects_duplicate_paths():
    data = make_multi_file_verified_report()
    data["changed_files"].append(
        data["changed_files"][0].copy()
    )
    data["evidence"][2]["changed_files"] = data["changed_files"]

    with pytest.raises(
        ValidationError,
        match="duplicate paths",
    ):
        RepairReport.model_validate(data)


def test_multi_file_report_rejects_primary_hash_mismatch():
    data = make_multi_file_verified_report()
    data["changed_files"][0]["source_sha256_after"] = "e" * 64
    data["evidence"][2]["changed_files"] = data["changed_files"]

    with pytest.raises(
        ValidationError,
        match="Primary source hashes",
    ):
        RepairReport.model_validate(data)


def test_multi_file_report_rejects_inconsistent_file_evidence():
    data = make_multi_file_verified_report()
    data["evidence"][2]["changed_files"][1][
        "source_sha256_after"
    ] = "e" * 64

    with pytest.raises(
        ValidationError,
        match="must match patch application evidence",
    ):
        RepairReport.model_validate(data)