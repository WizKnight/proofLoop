from pathlib import PurePosixPath, PureWindowsPath
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RepositoryManifest(BaseModel):
    """Validated inventory of files discovered in a Python project."""

    model_config = ConfigDict(extra="forbid")

    source_files: list[str] = Field(default_factory=list)
    test_files: list[str] = Field(default_factory=list)
    config_files: list[str] = Field(default_factory=list)

    total_files: int = Field(ge=0)
    total_bytes: int = Field(ge=0)

    skipped_directories: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_manifest(self) -> Self:
        collections = (
            self.source_files,
            self.test_files,
            self.config_files,
        )

        for collection in collections:
            if len(collection) != len(set(collection)):
                raise ValueError("Manifest contains duplicate paths")

            for path in collection:
                posix_path = PurePosixPath(path)
                windows_path = PureWindowsPath(path)

                if (
                    not path
                    or posix_path.is_absolute()
                    or windows_path.is_absolute()
                    or windows_path.drive
                    or ".." in posix_path.parts
                    or ".." in windows_path.parts
                    or "\\" in path
                ):
                    raise ValueError(
                        "Manifest paths must be safe relative POSIX paths"
                    )

        all_files = (
            self.source_files
            + self.test_files
            + self.config_files
        )

        if len(all_files) != len(set(all_files)):
            raise ValueError(
                "A file cannot appear in multiple manifest categories"
            )

        if self.total_files < len(all_files):
            raise ValueError(
                "Total file count cannot be smaller than discovered files"
            )

        return self
