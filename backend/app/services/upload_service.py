from __future__ import annotations

import stat
import tempfile
import zipfile
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import BinaryIO

MAX_ARCHIVE_BYTES = 25 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 1_000
MAX_EXTRACTED_FILES = 500
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_TOTAL_BYTES = 20 * 1024 * 1024

ALLOWED_COMPRESSION = {
    zipfile.ZIP_STORED,
    zipfile.ZIP_DEFLATED,
}

CONFIG_FILENAMES = {
    "pyproject.toml",
    "requirements.txt",
    "requirements-dev.txt",
    "pytest.ini",
    "setup.cfg",
    "tox.ini",
}

def _reject_raw_backslash_names(archive_data: bytes) -> None:
    """Reject backslashes in raw ZIP central-directory filenames."""
    import struct

    eocd_signature = b"PK\x05\x06"
    central_signature = b"PK\x01\x02"

    eocd_offset = archive_data.rfind(eocd_signature)

    if eocd_offset < 0 or eocd_offset + 22 > len(archive_data):
        raise ValueError("Invalid ZIP end-of-central-directory record")

    (
        signature,
        disk_number,
        central_disk,
        entries_on_disk,
        total_entries,
        central_size,
        central_offset,
        comment_length,
    ) = struct.unpack_from("<4s4H2LH", archive_data, eocd_offset)

    if (
        disk_number != 0
        or central_disk != 0
        or entries_on_disk != total_entries
        or eocd_offset + 22 + comment_length != len(archive_data)
    ):
        raise ValueError("Multi-disk or malformed ZIP archives are not supported")

    if central_offset + central_size > eocd_offset:
        raise ValueError("Invalid ZIP central directory")

    position = central_offset
    central_end = central_offset + central_size

    for _ in range(total_entries):
        if position + 46 > central_end:
            raise ValueError("Malformed ZIP central directory")

        if archive_data[position:position + 4] != central_signature:
            raise ValueError("Malformed ZIP central directory entry")

        filename_length, extra_length, entry_comment_length = (
            struct.unpack_from("<HHH", archive_data, position + 28)
        )

        filename_start = position + 46
        filename_end = filename_start + filename_length

        if filename_end > central_end:
            raise ValueError("Malformed ZIP filename")

        raw_filename = archive_data[filename_start:filename_end]

        if b"\\" in raw_filename:
            raise ValueError("ZIP paths must use forward slashes")

        position = (
            filename_end
            + extra_length
            + entry_comment_length
        )

    if position != central_end:
        raise ValueError("Invalid ZIP central directory size")

def _validate_member(info: zipfile.ZipInfo) -> tuple[Path, bool]:
    """Validate a ZIP entry and return its safe relative path and type."""
    name = info.orig_filename

    if not name or "\x00" in name:
        raise ValueError("ZIP contains an invalid entry name")

    if "\\" in name:
        raise ValueError("ZIP paths must use forward slashes")

    if name.startswith("/"):
        raise ValueError("ZIP contains an absolute path")

    windows_path = PureWindowsPath(name)

    if windows_path.is_absolute() or windows_path.drive:
        raise ValueError("ZIP contains a Windows absolute or drive path")

    is_directory = info.is_dir()
    normalized_name = name[:-1] if is_directory else name

    parts = normalized_name.split("/")

    if (
        not normalized_name
        or any(part in {"", ".", ".."} for part in parts)
        or any(":" in part for part in parts)
        or any(part.endswith((" ", ".")) for part in parts)
    ):
        raise ValueError("ZIP contains an unsafe relative path")

    # Reject Windows reserved device names, including names with extensions.
    reserved_names = {
        "CON", "PRN", "AUX", "NUL",
        *(f"COM{i}" for i in range(1, 10)),
        *(f"LPT{i}" for i in range(1, 10)),
    }

    for part in parts:
        stem = part.split(".", 1)[0].upper()

        if stem in reserved_names:
            raise ValueError("ZIP contains a reserved filesystem name")

    # ZIP entries can encode Unix file types in external_attr.
    unix_mode = (info.external_attr >> 16) & 0xFFFF
    file_type = stat.S_IFMT(unix_mode)

    if file_type == stat.S_IFLNK:
        raise ValueError("ZIP symlinks are not allowed")

    if is_directory:
        if file_type not in {0, stat.S_IFDIR}:
            raise ValueError("ZIP contains an invalid directory entry")
    elif file_type not in {0, stat.S_IFREG}:
        raise ValueError("ZIP contains a special filesystem entry")

    if info.flag_bits & 0x1:
        raise ValueError("Encrypted ZIP entries are not supported")

    if info.compress_type not in ALLOWED_COMPRESSION:
        raise ValueError("ZIP uses an unsupported compression method")

    return Path(*parts), is_directory


def extract_repository_zip(
    archive_data: bytes,
) -> tempfile.TemporaryDirectory[str]:
    """
    Safely extract a bounded ZIP archive into a temporary directory.

    The caller owns the returned TemporaryDirectory and must call cleanup().
    """
    if not isinstance(archive_data, bytes):
        raise TypeError("Archive data must be bytes")

    if not archive_data:
        raise ValueError("Uploaded ZIP archive is empty")

    if len(archive_data) > MAX_ARCHIVE_BYTES:
        raise ValueError("Uploaded ZIP exceeds the 25 MiB limit")

    workspace = tempfile.TemporaryDirectory(prefix="proofloop-upload-")
    root = Path(workspace.name)

    try:
        import io
        _reject_raw_backslash_names(archive_data)
        try:
            zip_file = zipfile.ZipFile(io.BytesIO(archive_data))
        except (zipfile.BadZipFile, OSError) as exc:
            raise ValueError("Uploaded file is not a valid ZIP archive") from exc

        with zip_file:
            entries = zip_file.infolist()

            if not entries:
                raise ValueError("ZIP archive contains no entries")

            if len(entries) > MAX_ARCHIVE_ENTRIES:
                raise ValueError("ZIP archive contains too many entries")

            seen_paths: set[str] = set()
            file_count = 0
            total_size = 0

            validated_entries = []

            for info in entries:
                relative_path, is_directory = _validate_member(info)
                normalized = relative_path.as_posix()

                # Reject duplicate paths and case-insensitive collisions.
                collision_key = normalized.casefold()

                if collision_key in seen_paths:
                    raise ValueError("ZIP contains duplicate file paths")

                seen_paths.add(collision_key)

                if is_directory:
                    validated_entries.append(
                        (info, relative_path, True)
                    )
                    continue

                file_count += 1
                total_size += info.file_size

                if file_count > MAX_EXTRACTED_FILES:
                    raise ValueError("ZIP contains too many files")

                if info.file_size > MAX_FILE_BYTES:
                    raise ValueError(
                        f"ZIP file exceeds the 2 MiB limit: {normalized}"
                    )

                if total_size > MAX_TOTAL_BYTES:
                    raise ValueError(
                        "ZIP extracted contents exceed the 20 MiB limit"
                    )

                # Reject inconsistent metadata before extraction.
                if info.file_size < 0 or info.compress_size < 0:
                    raise ValueError("ZIP contains invalid size metadata")

                validated_entries.append(
                    (info, relative_path, False)
                )

            for info, relative_path, is_directory in validated_entries:
                destination = root / relative_path

                # Defense in depth: ensure the resolved path stays in root.
                if not destination.resolve().is_relative_to(root.resolve()):
                    raise ValueError("ZIP entry escapes extraction directory")

                if is_directory:
                    destination.mkdir(parents=True, exist_ok=True)
                    continue

                destination.parent.mkdir(parents=True, exist_ok=True)

                # Exclusive creation prevents overwriting an existing entry.
                with zip_file.open(info, "r") as source:
                    with destination.open("xb") as target:
                        copied = 0

                        while True:
                            chunk = source.read(64 * 1024)

                            if not chunk:
                                break

                            copied += len(chunk)

                            if copied > MAX_FILE_BYTES:
                                raise ValueError(
                                    f"Extracted file exceeds the size limit: "
                                    f"{relative_path.as_posix()}"
                                )

                            target.write(chunk)

                        if copied != info.file_size:
                            raise ValueError(
                                f"ZIP entry size mismatch: "
                                f"{relative_path.as_posix()}"
                            )

        return workspace

    except Exception:
        workspace.cleanup()
        raise
