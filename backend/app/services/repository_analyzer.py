import os
from pathlib import Path

from backend.app.schemas.repository import RepositoryManifest


MAX_DISCOVERED_FILES = 500
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_TOTAL_BYTES = 20 * 1024 * 1024

EXCLUDED_DIRECTORIES = {
    ".git",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    "node_modules",
    "dist",
    "build",
    "site-packages",
}

CONFIG_FILENAMES = {
    "pyproject.toml",
    "requirements.txt",
    "requirements-dev.txt",
    "pytest.ini",
    "setup.cfg",
    "tox.ini",
}

TEST_PREFIXES = ("test_",)
TEST_SUFFIXES = ("_test.py",)


def _is_test_file(relative_path: str) -> bool:
    """Identify common pytest test modules and conftest files."""
    name = Path(relative_path).name

    return (
        name == "conftest.py"
        or name.startswith(TEST_PREFIXES)
        or name.endswith(TEST_SUFFIXES)
    )


def analyze_repository(project_root: Path) -> RepositoryManifest:
    """
    Discover relevant Python and configuration files without
    executing project code.

    Symlinks and excluded directories are never followed.
    """
    if project_root.is_symlink():
        raise ValueError("Project root must not be a symlink")

    if not project_root.exists() or not project_root.is_dir():
        raise ValueError("Project root must be an existing directory")

    root = project_root.resolve()

    source_files: list[str] = []
    test_files: list[str] = []
    config_files: list[str] = []
    skipped_directories: list[str] = []

    total_files = 0
    total_bytes = 0

    for current_dir, directory_names, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False,
    ):
        current_path = Path(current_dir)

        # Prune excluded and symlinked directories before traversal.
        retained_directories = []

        for directory_name in directory_names:
            directory_path = current_path / directory_name

            relative_directory = directory_path.relative_to(root).as_posix()

            if directory_name in EXCLUDED_DIRECTORIES:
                skipped_directories.append(relative_directory)
                continue

            if directory_path.is_symlink():
                skipped_directories.append(relative_directory)
                continue

            retained_directories.append(directory_name)

        directory_names[:] = sorted(retained_directories)

        for filename in sorted(filenames):
            file_path = current_path / filename

            if file_path.is_symlink():
                continue

            if not file_path.is_file():
                continue

            relative_path = file_path.relative_to(root).as_posix()

            is_python = filename.endswith(".py")
            is_config = filename in CONFIG_FILENAMES

            if not is_python and not is_config:
                continue

            if not file_path.resolve().is_relative_to(root):
                raise ValueError("Discovered file escapes project root")

            file_size = file_path.stat().st_size

            if file_size > MAX_FILE_BYTES:
                raise ValueError(
                    f"Repository file exceeds size limit: {relative_path}"
                )

            total_files += 1
            total_bytes += file_size

            if total_files > MAX_DISCOVERED_FILES:
                raise ValueError("Repository exceeds discovered file limit")

            if total_bytes > MAX_TOTAL_BYTES:
                raise ValueError("Repository exceeds total size limit")

            if is_python and _is_test_file(relative_path):
                test_files.append(relative_path)
            elif is_python:
                source_files.append(relative_path)
            elif is_config:
                config_files.append(relative_path)

    return RepositoryManifest(
        source_files=sorted(source_files),
        test_files=sorted(test_files),
        config_files=sorted(config_files),
        total_files=total_files,
        total_bytes=total_bytes,
        skipped_directories=sorted(skipped_directories),
    )
