
import pytest
import json
from types import SimpleNamespace

from backend.app.schemas.patch import PatchProposal

from backend.app.services import meta_client


def test_missing_api_key_fails_clearly(monkeypatch):
    monkeypatch.setattr(
        meta_client, "load_dotenv", lambda *args, **kwargs: None
    )
    monkeypatch.delenv("MODEL_API_KEY", raising=False)

    with pytest.raises(ValueError, match="MODEL_API_KEY"):
        meta_client.create_meta_client()


def test_empty_prompt_is_rejected(monkeypatch):
    def unexpected_client_creation():
        pytest.fail("Client should not be created for an empty prompt")

    monkeypatch.setattr(
        meta_client, "create_meta_client", unexpected_client_creation
    )

    with pytest.raises(ValueError, match="Prompt"):
        meta_client.generate_text("   ")


def test_invalid_timeout_is_rejected(monkeypatch):
    monkeypatch.setattr(
        meta_client, "load_dotenv", lambda *args, **kwargs: None
    )
    monkeypatch.setenv("MODEL_API_KEY", "test-key")
    monkeypatch.setenv("MODEL_API_TIMEOUT_SECONDS", "0")

    with pytest.raises(ValueError, match="must be positive"):
        meta_client.create_meta_client()


def make_fake_meta_client(payload: dict):
    """Build a minimal fake Meta client response."""
    content = json.dumps(payload)

    return SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(
                create=lambda **kwargs: SimpleNamespace(
                    choices=[
                        SimpleNamespace(
                            message=SimpleNamespace(content=content)
                        )
                    ]
                )
            )
        )
    )


def test_repository_patch_proposal_supports_multiple_files(monkeypatch):
    source_files = {
        "src/billing.py": (
            "from src.pricing import calculate_price\n"
            "def checkout(price, discount):\n"
            "    return calculate_price(price, discount)\n"
        ),
        "src/pricing.py": (
            "def calculate_price(price, discount):\n"
            "    if discount == 100:\n"
            "        return price\n"
            "    return price * (1 - discount / 100)\n"
        ),
    }

    payload = {
        "root_cause": (
            "The full-discount branch returns the original price."
        ),
        "diagnosis_evidence": [
            "The 100 percent branch returns price.",
            "The caller delegates calculation to calculate_price.",
        ],
        "summary": "Correct the full-discount calculation.",
        "edits": [
            {
                "path": "src/pricing.py",
                "old_text": (
                    "    if discount == 100:\n"
                    "        return price"
                ),
                "new_text": (
                    "    if discount == 100:\n"
                    "        return 0"
                ),
                "explanation": "A full discount must produce zero.",
            }
        ],
    }

    monkeypatch.setattr(
        meta_client,
        "_required_env",
        lambda name, default=None: default or "test-model",
    )

    monkeypatch.setattr(
        meta_client,
        "create_meta_client",
        lambda: make_fake_meta_client(payload),
    )

    proposal = meta_client.generate_repository_patch_proposal(
        bug_report="A 100 percent discount returns the original price.",
        source_files=source_files,
        test_output="FAILED test_full_discount",
        allowed_paths=set(source_files),
    )

    assert isinstance(proposal, PatchProposal)
    assert proposal.root_cause
    assert len(proposal.diagnosis_evidence) == 2
    assert proposal.edits[0].path == "src/pricing.py"


def test_repository_patch_rejects_unapproved_edit(monkeypatch):
    source_files = {
        "src/app.py": "def run():\n    return 1\n",
    }

    payload = {
        "root_cause": "Incorrect return value.",
        "diagnosis_evidence": ["The function returns 1."],
        "summary": "Correct the return value.",
        "edits": [
            {
                "path": "tests/test_app.py",
                "old_text": "assert run() == 1",
                "new_text": "assert run() == 2",
                "explanation": "Intentionally invalid target.",
            }
        ],
    }

    monkeypatch.setattr(
        meta_client,
        "_required_env",
        lambda name, default=None: default or "test-model",
    )

    monkeypatch.setattr(
        meta_client,
        "create_meta_client",
        lambda: make_fake_meta_client(payload),
    )

    with pytest.raises(ValueError, match="outside the approved"):
        meta_client.generate_repository_patch_proposal(
            bug_report="The function returns the wrong value.",
            source_files=source_files,
            test_output="FAILED test_run",
            allowed_paths={"src/app.py"},
        )


def test_repository_patch_rejects_non_unique_old_text(monkeypatch):
    source_files = {
        "src/app.py": "return 1\nreturn 1\n",
    }

    payload = {
        "root_cause": "Incorrect return value.",
        "diagnosis_evidence": ["Two matching statements exist."],
        "summary": "Correct one return statement.",
        "edits": [
            {
                "path": "src/app.py",
                "old_text": "return 1",
                "new_text": "return 2",
                "explanation": "Correct the return value.",
            }
        ],
    }

    monkeypatch.setattr(
        meta_client,
        "_required_env",
        lambda name, default=None: default or "test-model",
    )

    monkeypatch.setattr(
        meta_client,
        "create_meta_client",
        lambda: make_fake_meta_client(payload),
    )

    with pytest.raises(ValueError, match="exactly once"):
        meta_client.generate_repository_patch_proposal(
            bug_report="The function returns the wrong value.",
            source_files=source_files,
            test_output="FAILED test_run",
            allowed_paths={"src/app.py"},
        )


def test_repository_patch_rejects_context_path_traversal():
    with pytest.raises(ValueError, match="unsafe path"):
        meta_client.generate_repository_patch_proposal(
            bug_report="A bug exists.",
            source_files={"../outside.py": "VALUE = 1"},
            test_output="FAILED test_run",
            allowed_paths={"../outside.py"},
        )


def test_repository_patch_rejects_excessive_context():
    source_files = {
        f"src/module_{index}.py": "VALUE = 1"
        for index in range(meta_client.MAX_REPAIR_CONTEXT_FILES + 1)
    }

    with pytest.raises(ValueError, match="file limit"):
        meta_client.generate_repository_patch_proposal(
            bug_report="A bug exists.",
            source_files=source_files,
            test_output="FAILED test_run",
            allowed_paths=set(source_files),
        )


def test_repository_patch_rejects_empty_baseline_output():
    with pytest.raises(ValueError, match="test output"):
        meta_client.generate_repository_patch_proposal(
            bug_report="A bug exists.",
            source_files={"src/app.py": "VALUE = 1"},
            test_output=" ",
            allowed_paths={"src/app.py"},
        )

