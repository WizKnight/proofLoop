# Password Validator

A small Python project demonstrating automated bug investigation
and evidence-backed repair with ProofLoop.

## Bug

The validator rejects passwords containing exactly eight characters,
even though eight characters is the minimum permitted length.

## Expected behavior

- Passwords must contain at least 8 characters.
- Passwords must contain at least one uppercase letter.
- Passwords must contain at least one digit.
- Invalid passwords return False.

## Run tests

```bash
pip install -r requirements.txt
python -m pytest -q