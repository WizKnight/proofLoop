def normalize_username(username: str) -> str:
    """Normalize a username by trimming whitespace and converting to lowercase."""
    # Intentional bug: leading and trailing whitespace is not removed.
    return username.lower()
