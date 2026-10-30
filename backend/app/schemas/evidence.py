
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EvidenceEntry(BaseModel):
    """One auditable step in the repair and verification process."""

    model_config = ConfigDict(extra="allow")

    step: str = Field(min_length=1)

    # Baseline test evidence
    failure_reproduced: bool | None = None
    expected_failure: str | None = None

    # Patch generation and application evidence
    success: bool | None = None
    edits: list[dict[str, Any]] | None = None
    source_path: str | None = None
    source_sha256: str | None = None
    source_sha256_before: str | None = None
    source_sha256_after: str | None = None
    diff: str | None = None

    # Test execution evidence
    execution_id: str | None = None
    command: list[str] | None = None
    exit_code: int | None = None
    timed_out: bool | None = None
    tests_passed: bool | None = None
    stdout: str | None = None
    stderr: str | None = None

    executor: str | None = None
    sandbox_image: str | None = None
    execution_started: bool | None = None

    # Optional error classification
    error_type: str | None = None


class RepairReport(BaseModel):
    """Validated, machine-readable ProofLoop repair report."""

    model_config = ConfigDict(extra="forbid")

    project: str = Field(min_length=1)
    timestamp_utc: datetime
    status: Literal["verified", "unverified"]
    summary: str = Field(min_length=1)
    evidence: list[EvidenceEntry]

    patch_summary: str | None = None
    diff: str | None = None
    verification_scope: str | list[str] | tuple[str, ...] | None = None
    error: str | None = None

    @model_validator(mode="after")
    def validate_verified_report(self) -> "RepairReport":
        if self.status != "verified":
            return self

        steps = {entry.step: entry for entry in self.evidence}

        baseline = steps.get("baseline_tests")
        generation = steps.get("patch_generation")
        application = steps.get("patch_application")
        post_tests = steps.get("post_patch_tests")

        # 1. Baseline failure must be reproduced by a completed Docker run.
        if baseline is None or baseline.failure_reproduced is not True:
            raise ValueError(
                "Verified report requires a reproduced baseline failure"
            )

        if (
            baseline.executor != "docker"
            or baseline.execution_started is not True
            or baseline.exit_code is None
            or baseline.exit_code == 0
            or baseline.timed_out is not False
            or not baseline.execution_id
            or not baseline.command
        ):
            raise ValueError(
                "Baseline failure must come from a completed Docker test run"
            )

        # 2. A successful patch proposal must exist.
        if generation is None or generation.success is not True:
            raise ValueError(
                "Verified report requires a successful patch proposal"
            )

        # 3. The patch must have been successfully applied.
        if application is None or application.success is not True:
            raise ValueError(
                "Verified report requires a successfully applied patch"
            )

        before_hash = application.source_sha256_before
        after_hash = application.source_sha256_after

        if (
            not before_hash
            or not after_hash
            or before_hash == after_hash
        ):
            raise ValueError(
                "Verified report requires different before and after source hashes"
            )

        if baseline.source_sha256 != before_hash:
            raise ValueError(
                "Baseline source hash must match the patch's original source hash"
            )

        if not application.diff or not self.diff:
            raise ValueError(
                "Verified report requires a patch diff"
            )

        if application.diff != self.diff:
            raise ValueError(
                "Top-level diff must match patch application evidence"
            )

        # 4. Post-patch tests must pass in a completed Docker run.
        if (
            post_tests is None
            or post_tests.tests_passed is not True
            or post_tests.exit_code != 0
            or post_tests.timed_out is not False
            or post_tests.executor != "docker"
            or post_tests.execution_started is not True
            or not post_tests.execution_id
            or not post_tests.command
        ):
            raise ValueError(
                "Verified report requires successful post-patch Docker tests"
            )

        # 5. Each test execution must have its own identity.
        if baseline.execution_id == post_tests.execution_id:
            raise ValueError(
                "Baseline and post-patch executions must have distinct IDs"
            )

        # 6. Verification scope must be explicitly stated.
        if not self.verification_scope:
            raise ValueError(
                "Verified report requires a verification scope"
            )

        return self
