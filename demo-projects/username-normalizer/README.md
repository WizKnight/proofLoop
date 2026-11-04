# Username Normalizer

A small Python project demonstrating automated bug investigation
and evidence-backed repair with ProofLoop.

## Bug

The username normalizer converts text to lowercase but does not
remove leading or trailing whitespace.

## Expected behavior

- Convert usernames to lowercase.
- Remove leading whitespace.
- Remove trailing whitespace.
- Preserve internal spaces.

## Run tests

```bash
pip install -r requirements.txt
python -m pytest -q