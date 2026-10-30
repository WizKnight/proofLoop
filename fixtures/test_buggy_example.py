
import pytest

from fixtures.buggy_example import calculate_discount


def test_partial_discount():
    assert calculate_discount(100, 20) == pytest.approx(80)


def test_no_discount():
    assert calculate_discount(100, 0) == pytest.approx(100)


def test_full_discount():
    assert calculate_discount(100, 100) == pytest.approx(0)


def test_negative_discount_is_rejected():
    with pytest.raises(ValueError):
        calculate_discount(100, -1)


def test_discount_over_100_is_rejected():
    with pytest.raises(ValueError):
        calculate_discount(100, 101)
