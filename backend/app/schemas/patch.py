from pathlib import PurePosixPath, PureWindowsPath
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FileEdit(BaseModel):
    """One exact-text replacement in an approved source file."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)

    path: str = Field(min_length=1, max_length=200)
    old_text: str = Field(min_length=1, max_length=20_000)
    new_text: str = Field(max_length=20_000)
    explanation: str = Field(min_length=1, max_length=1_000)

    @model_validator(mode="after")
    def validate_edit(self) -> Self:
        posix_path = PurePosixPath(self.path)
        windows_path = PureWindowsPath(self.path)

        if (
            posix_path.is_absolute()
            or windows_path.is_absolute()
            or windows_path.drive
            or ".." in posix_path.parts
            or ".." in windows_path.parts
            or "\\" in self.path
        ):
            raise ValueError("Patch path must be a safe relative POSIX path")

        if posix_path.as_posix() in ("", "."):
            raise ValueError("Patch path must identify a file")

        if self.old_text == self.new_text:
            raise ValueError("Patch must change the original text")

        return self


class PatchProposal(BaseModel):
    """A bounded patch proposal returned by the model."""

    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=1_000)
    edits: list[FileEdit] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def validate_unique_paths(self) -> Self:
        paths = [edit.path for edit in self.edits]
        if len(paths) != len(set(paths)):
            raise ValueError("Only one edit per file is allowed")
        return self
