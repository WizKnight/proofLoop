from src.username import normalize_username


def test_converts_to_lowercase():
    assert normalize_username("Swapnil") == "swapnil"


def test_removes_leading_whitespace():
    assert normalize_username("  swapnil") == "swapnil"


def test_removes_trailing_whitespace():
    assert normalize_username("swapnil  ") == "swapnil"


def test_removes_both_sides_of_whitespace():
    assert normalize_username("  Swapnil  ") == "swapnil"


def test_preserves_internal_spaces():
    assert normalize_username("swapnil jikar") == "swapnil jikar"