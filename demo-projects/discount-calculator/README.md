# Discount Calculator

A small Python project for demonstrating automated bug investigation
and evidence-backed repair with ProofLoop.

## Bug

A 100% discount incorrectly returns the original price instead of zero.

## Expected behavior

- 20% discount on 100 returns 80.
- 0% discount on 100 returns 100.
- 100% discount on 100 returns 0.
- Discounts outside the 0–100 range raise ValueError.

## Run tests

```bash
pip install -r requirements.txt
python -m pytest -q