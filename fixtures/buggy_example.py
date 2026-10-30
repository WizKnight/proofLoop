
def calculate_discount(price: float, discount_percent: float) -> float:
    """Return the price after applying a percentage discount."""
    if discount_percent < 0 or discount_percent > 100:
        raise ValueError("discount_percent must be between 0 and 100")

    # Intentional bug: 100% discount should return 0.
    if discount_percent == 100:
        return price

    return price * (1 - discount_percent / 100)
