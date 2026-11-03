from pathlib import Path

import pytest

from backend.app.services.repository_analyzer import (
    MAX_FILE_BYTES,
    MAX_TOTAL_BYTES,
    analyze_repository,
)


def write_file(root: Path, relative_path: str, content: str = "") -> Path:
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def test_discovers_python_source_tests_and_configuration(tmp_path: Path):
    write_file(tmp_path, "src/app.py", "def run():\n    return True\n")
    write_file(tmp_path, "src/utils.py", "VALUE = 10\n")
    write_file(tmp_path, "tests/test_app.py", "def test_run():\n    assert True\n")
    write_file(tmp_path, "src/helpers_test.py", "def test_helper():\n    pass\n")
    write_file(tmp_path, "tests/conftest.py", "")
    write_file(tmp_path, "pyproject.toml", "[tool.pytest.ini_options]\n")
    write_file(tmp_path, "requirements.txt", "pytest\n")
    write_file(tmp_path, "README.md", "Project documentation")

    manifest = analyze_repository(tmp_path)

    assert manifest.source_files == [
        "src/app.py",
        "src/utils.py",
    ]

    assert manifest.test_files == [
        "src/helpers_test.py",
        "tests/conftest.py",
        "tests/test_app.py",
    ]

    assert manifest.config_files == [
        "pyproject.toml",
        "requirements.txt",
    ]

    assert manifest.total_files == 7
    assert manifest.total_bytes > 0


def test_excludes_virtual_environments_and_generated_directories(
    tmp_path: Path,
):
    write_file(tmp_path, "src/app.py", "VALUE = 1\n")
    write_file(tmp_path, ".venv/lib/hidden.py", "VALUE = 2\n")
    write_file(tmp_path, "__pycache__/cached.py", "VALUE = 3\n")
    write_file(tmp_path, "node_modules/package/index.py", "VALUE = 4\n")
    write_file(tmp_path, "build/generated.py", "VALUE = 5\n")

    manifest = analyze_repository(tmp_path)

    assert manifest.source_files == ["src/app.py"]

    assert set(manifest.skipped_directories) == {
        ".venv",
        "__pycache__",
        "node_modules",
        "build",
    }


def test_ignores_non_python_non_configuration_files(tmp_path: Path):
    write_file(tmp_path, "README.md", "Documentation")
    write_file(tmp_path, ".env", "SECRET=value")
    write_file(tmp_path, "data.json", '{"key": "value"}')
    write_file(tmp_path, "src/app.py", "VALUE = 1\n")

    manifest = analyze_repository(tmp_path)

    assert manifest.source_files == ["src/app.py"]
    assert manifest.test_files == []
    assert manifest.config_files == []


def test_rejects_nonexistent_project_root(tmp_path: Path):
    with pytest.raises(ValueError, match="existing directory"):
        analyze_repository(tmp_path / "missing")


def test_rejects_file_as_project_root(tmp_path: Path):
    file_path = tmp_path / "project.py"
    file_path.write_text("VALUE = 1\n", encoding="utf-8")

    with pytest.raises(ValueError, match="existing directory"):
        analyze_repository(file_path)


def test_rejects_oversized_file(tmp_path: Path):
    write_file(
        tmp_path,
        "src/large.py",
        "A" * (MAX_FILE_BYTES + 1),
    )

    with pytest.raises(ValueError, match="exceeds size limit"):
        analyze_repository(tmp_path)


def test_rejects_repository_exceeding_total_size(tmp_path: Path):
    # Keep each individual file below MAX_FILE_BYTES (2 MB)
    file_size = 1024 * 1024  # 1 MB
    num_files = (MAX_TOTAL_BYTES // file_size) + 1  # 21 files = 21 MB total

    for i in range(num_files):
        write_file(tmp_path, f"src/module_{i}.py", "A" * file_size)

    with pytest.raises(ValueError, match="total size limit"):
        analyze_repository(tmp_path)


def test_ignores_symlinked_files(tmp_path: Path):
    outside = tmp_path.parent / "outside_module.py"
    outside.write_text("SECRET = True\n", encoding="utf-8")

    link = tmp_path / "linked.py"

    try:
        link.symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("Symlink creation is unavailable")

    write_file(tmp_path, "src/app.py", "VALUE = 1\n")

    manifest = analyze_repository(tmp_path)

    assert manifest.source_files == ["src/app.py"]
    assert "linked.py" not in manifest.source_files


def test_skips_symlinked_directories(tmp_path: Path):
    outside = tmp_path.parent / "outside_project"
    outside.mkdir()
    (outside / "secret.py").write_text(
        "SECRET = True\n",
        encoding="utf-8",
    )

    link = tmp_path / "external"

    try:
        link.symlink_to(outside, target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("Directory symlink creation is unavailable")

    write_file(tmp_path, "src/app.py", "VALUE = 1\n")

    manifest = analyze_repository(tmp_path)

    assert manifest.source_files == ["src/app.py"]
    assert "external" in manifest.skipped_directories
