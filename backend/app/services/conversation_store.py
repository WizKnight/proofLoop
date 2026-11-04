import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import threading
from functools import wraps
from collections.abc import Callable


PROJECT_ROOT = Path(__file__).resolve().parents[3]
CONVERSATIONS_DIR = PROJECT_ROOT / "artifacts" / "conversations"

MAX_MESSAGES = 40

_lock_registry: dict[str, threading.Lock] = {}
_lock_registry_guard = threading.Lock()


def conversation_locked(func: Callable):
    """Serialize conversation operations for the same repair job."""

    @wraps(func)
    def wrapper(job_id, *args, **kwargs):
        key = str(UUID(str(job_id)))

        with _lock_registry_guard:
            lock = _lock_registry.setdefault(key, threading.Lock())

        with lock:
            return func(job_id, *args, **kwargs)

    return wrapper


def _conversation_path(job_id: str | UUID) -> Path:
    validated_id = UUID(str(job_id))
    return CONVERSATIONS_DIR / f"{validated_id}.json"


def load_conversation(job_id: str | UUID) -> list[dict[str, Any]]:
    """Load persisted messages for a repair session."""
    path = _conversation_path(job_id)

    if not path.is_file():
        return []

    data = json.loads(path.read_text(encoding="utf-8"))

    if not isinstance(data, list):
        raise ValueError("Conversation must be a JSON array")

    if len(data) > MAX_MESSAGES:
        raise ValueError("Stored conversation exceeds message limit")

    return data


def save_conversation(
    job_id: str | UUID,
    messages: list[dict[str, Any]],
) -> None:
    """Atomically persist bounded conversation history."""
    if len(messages) > MAX_MESSAGES:
        raise ValueError("Conversation exceeds message limit")

    destination = _conversation_path(job_id)
    destination.parent.mkdir(parents=True, exist_ok=True)

    temporary_path = destination.with_suffix(".tmp")

    try:
        temporary_path.write_text(
            json.dumps(messages, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        os.replace(temporary_path, destination)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def create_message(
    role: str,
    content: str,
    client_request_id: UUID | None = None,
) -> dict[str, Any]:
    """Create a timestamped conversation message."""
    if role not in {"user", "assistant"}:
        raise ValueError("Invalid conversation message role")

    message = {
        "id": os.urandom(16).hex(),
        "role": role,
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if client_request_id is not None:
        message["client_request_id"] = str(client_request_id)

    return message
