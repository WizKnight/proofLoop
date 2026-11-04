def is_valid_password(password: str) -> bool:
    """Validate password length, uppercase letters, and digits."""

    # Intentional bug: exactly 8 characters should be accepted.
    if len(password) <= 8:
        return False

    has_uppercase = any(char.isupper() for char in password)
    has_digit = any(char.isdigit() for char in password)

    return has_uppercase and has_digit