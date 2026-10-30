from backend.app.services.meta_client import generate_text


def main() -> None:
    result = generate_text(
        "Reply with exactly this one word: READY"
    )
    print("Meta API connection successful.")
    print(f"Model response: {result}")


if __name__ == "__main__":
    main()
