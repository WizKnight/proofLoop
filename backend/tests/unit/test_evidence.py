import pytest
from pydantic import ValidationError

from backend.app.schemas.evidence import ChangedFileEvidence


def test_changed_file_evidence_accepts_valid_hashes():
    evidence = ChangedFileEvidence(
        path="src/pricing.py",
        source_sha256_before="a" * 64,
        source_sha256_after="b" * 64,
    )

    assert evidence.path == "src/pricing.py"


@pytest.mark.parametrize(
    "path",
    [
        "../outside.py",
        "/absolute/file.py",
        r"C:\outside.py",
        "src\\outside.py",
        "src/../outside.py",
    ],
)
def test_changed_file_evidence_rejects_unsafe_paths(path):
    with pytest.raises(ValidationError):
        ChangedFileEvidence(
            path=path,
            source_sha256_before="a" * 64,
            source_sha256_after="b" * 64,
        )


def test_changed_file_evidence_rejects_identical_hashes():
    with pytest.raises(ValidationError):
        ChangedFileEvidence(
            path="src/pricing.py",
            source_sha256_before="a" * 64,
            source_sha256_after="a" * 64,
        )