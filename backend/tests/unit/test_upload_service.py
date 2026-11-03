import io
import stat
import zipfile

import pytest

from backend.app.services.upload_service import extract_repository_zip


def make_zip(entries: list[tuple[str, str]]) -> bytes:
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in entries:
            archive.writestr(name, content)

    return buffer.getvalue()


def test_extracts_valid_repository():
    archive = make_zip([
        ("project/app.py", "def hello():\n    return 'hello'\n"),
        ("project/tests/test_app.py", "def test_hello():\n    assert True\n"),
    ])

    workspace = extract_repository_zip(archive)

    try:
        root = __import__("pathlib").Path(workspace.name)

        assert (root / "project/app.py").is_file()
        assert (root / "project/tests/test_app.py").is_file()
        assert (root / "project/app.py").read_text() == (
            "def hello():\n    return 'hello'\n"
        )
    finally:
        workspace.cleanup()


@pytest.mark.parametrize(
    "name",
    [
        "../outside.py",
        "project/../../outside.py",
        "/absolute.py",
        "C:/outside.py",
        "project/../outside.py",
    ],
)

def test_rejects_unsafe_paths(name):
    archive = make_zip([(name, "print('unsafe')")])

    with pytest.raises(ValueError):
        extract_repository_zip(archive)


def test_rejects_duplicate_paths():
    archive = make_zip([
        ("project/app.py", "first"),
        ("project/app.py", "second"),
    ])

    with pytest.raises(ValueError, match="duplicate"):
        extract_repository_zip(archive)


def test_rejects_case_insensitive_path_collisions():
    archive = make_zip([
        ("project/App.py", "first"),
        ("project/app.py", "second"),
    ])

    with pytest.raises(ValueError, match="duplicate"):
        extract_repository_zip(archive)


def test_rejects_symlink_entries():
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w") as archive:
        info = zipfile.ZipInfo("project/link.py")
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        archive.writestr(info, "target.py")

    with pytest.raises(ValueError, match="symlink"):
        extract_repository_zip(buffer.getvalue())


def test_rejects_invalid_zip():
    with pytest.raises(ValueError, match="valid ZIP"):
        extract_repository_zip(b"not a zip archive")


def test_rejects_empty_archive():
    with pytest.raises(ValueError, match="no entries"):
        extract_repository_zip(make_zip([]))


def test_rejects_empty_upload():
    with pytest.raises(ValueError, match="empty"):
        extract_repository_zip(b"")


def test_rejects_oversized_archive():
    from backend.app.services.upload_service import MAX_ARCHIVE_BYTES

    with pytest.raises(ValueError, match="25 MiB"):
        extract_repository_zip(b"x" * (MAX_ARCHIVE_BYTES + 1))


def test_rejects_oversized_extracted_file():
    from backend.app.services.upload_service import MAX_FILE_BYTES

    archive = make_zip([
        ("project/app.py", "x" * (MAX_FILE_BYTES + 1)),
    ])

    with pytest.raises(ValueError, match="2 MiB"):
        extract_repository_zip(archive)


def test_rejects_excessive_file_count():
    from backend.app.services.upload_service import MAX_EXTRACTED_FILES

    archive = make_zip([
        (f"project/file_{index}.py", "x")
        for index in range(MAX_EXTRACTED_FILES + 1)
    ])

    with pytest.raises(ValueError, match="too many files"):
        extract_repository_zip(archive)


def test_rejects_encrypted_entries():
    import struct

    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "project/app.py",
            "print('hello')",
        )

    raw = bytearray(buffer.getvalue())

    # Set the encryption flag in both the local file header
    # and central directory entry.
    local_header = raw.find(b"PK\x03\x04")
    central_header = raw.find(b"PK\x01\x02")

    assert local_header >= 0
    assert central_header >= 0

    local_flags = struct.unpack_from("<H", raw, local_header + 6)[0]
    central_flags = struct.unpack_from("<H", raw, central_header + 8)[0]

    struct.pack_into("<H", raw, local_header + 6, local_flags | 0x1)
    struct.pack_into("<H", raw, central_header + 8, central_flags | 0x1)

    with pytest.raises(ValueError, match="Encrypted"):
        extract_repository_zip(bytes(raw))