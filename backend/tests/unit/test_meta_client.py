
import pytest

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
