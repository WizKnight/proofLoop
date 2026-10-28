# ProofLoop

ProofLoop is an AI coding agent that investigates Python bugs,
proposes code patches, executes tests, and reports evidence
for whether a repair was verified.

## Project status

Hackathon MVP — in development.

## Planned workflow

1. Accept a bug report and Python repository.
2. Reproduce the reported failure.
3. Use a Meta model to diagnose the issue and propose a patch.
4. Apply the patch in an isolated workspace.
5. Rerun tests and capture execution evidence.
6. Generate an evidence-backed repair report.

## Technology

- Python 3.12
- FastAPI
- Meta Model API
- pytest
- Next.js and TypeScript (planned)

## Local development

Backend setup instructions will be added as the implementation
progresses.

## Security

Never commit API keys, secrets, private repositories, or
unlicensed source code.
