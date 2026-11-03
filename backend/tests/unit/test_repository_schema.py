import pytest
from pydantic import ValidationError

from backend.app.schemas.repository import RepositoryManifest


def test_valid_repository_manifest():
    manifest = RepositoryManifest(
        source_files=["src/app.py"],
        test_files=["tests/test_app.py"],
        config_files=["pyproject.toml"],
        total_files=3,
        total_bytes=1024,
    )

    assert manifest.total_files == 3
    assert len(manifest.source_files) == 1
    assert len(manifest.test_files) == 1


@pytest.mark.parametrize(
    "unsafe_path",
    [
        "../outside.py",
        "/etc/passwd",
        "C:/outside.py",
        r"..\outside.py",
        r"src\..\outside.py",
    ],
)
def test_manifest_rejects_unsafe_paths(unsafe_path: str):
    with pytest.raises(ValidationError):
        RepositoryManifest(
            source_files=[unsafe_path],
            total_files=1,
            total_bytes=100,
        )


def test_manifest_rejects_duplicate_paths():
    with pytest.raises(ValidationError, match="duplicate"):
        RepositoryManifest(
            source_files=["src/app.py", "src/app.py"],
            total_files=2,
            total_bytes=100,
        )


def test_manifest_rejects_file_in_multiple_categories():
    with pytest.raises(ValidationError, match="multiple"):
        RepositoryManifest(
            source_files=["tests/test_app.py"],
            test_files=["tests/test_app.py"],
            total_files=1,
            total_bytes=100,
        )


def test_manifest_rejects_inconsistent_file_count():
    with pytest.raises(ValidationError, match="Total file count"):
        RepositoryManifest(
            source_files=["src/app.py"],
            total_files=0,
            total_bytes=100,
        )
