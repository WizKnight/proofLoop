def paginate(items: list, page: int, page_size: int) -> list:
    """Return one page of items using 1-based page numbering."""
    if page < 1:
        raise ValueError("page must be at least 1")

    if page_size < 1:
        raise ValueError("page_size must be at least 1")

    start = (page - 1) * page_size

    # Intentional bug: pages after the first skip one item.
    if page > 1:
        start += 1

    end = start + page_size
    return items[start:end]