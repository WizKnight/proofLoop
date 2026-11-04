import pytest

from src.pagination import paginate


ITEMS = list(range(1, 11))


def test_first_page():
    assert paginate(ITEMS, 1, 3) == [1, 2, 3]


def test_second_page():
    assert paginate(ITEMS, 2, 3) == [4, 5, 6]


def test_third_page():
    assert paginate(ITEMS, 3, 3) == [7, 8, 9]


def test_last_partial_page():
    assert paginate(ITEMS, 4, 3) == [10]


def test_invalid_page():
    with pytest.raises(ValueError):
        paginate(ITEMS, 0, 3)


def test_invalid_page_size():
    with pytest.raises(ValueError):
        paginate(ITEMS, 1, 0)