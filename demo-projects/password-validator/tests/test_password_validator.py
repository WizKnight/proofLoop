from src.password_validator import is_valid_password


def test_accepts_password_with_exactly_eight_characters():
    assert is_valid_password("Abcdef1!") is True


def test_accepts_password_longer_than_eight_characters():
    assert is_valid_password("Abcdef123!") is True


def test_rejects_password_shorter_than_eight_characters():
    assert is_valid_password("Abc1!") is False


def test_rejects_password_without_uppercase():
    assert is_valid_password("abcdef123!") is False


def test_rejects_password_without_digit():
    assert is_valid_password("Abcdefghij!") is False


def test_rejects_empty_password():
    assert is_valid_password("") is False