# ProofLoop - Configuration Guide

## 1. Overview

ProofLoop consists of a Next.js frontend and a FastAPI backend.

The backend integrates with Meta's Model API and uses Docker for isolated repository execution.

This document describes the environment configuration and local development setup.

## 2. Prerequisites

Install the following:

| Requirement | Purpose |
|---|---|
| Python 3.11+ | Backend runtime |
| Node.js | Frontend runtime |
| npm | Frontend dependency management |
| Docker | Isolated repository execution |
| Git | Source control |
| Meta Model API key | AI-assisted investigation and patch generation |

Ensure Docker is installed and running before submitting repository repair jobs.

## 3. Environment Variables

ProofLoop uses a root-level `.env` file for backend model configuration.

Create the file from the supplied example:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS**

```bash
cp .env.example .env
```

### Backend Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MODEL_API_KEY` | Yes | None | API key used to authenticate with Meta's Model API. |
| `MODEL_NAME` | No | `muse-spark-1.3` | Model identifier used for model requests. |
| `MODEL_API_BASE_URL` | No | `https://api.meta.ai/v1` | Base URL for the Meta Model API. |
| `MODEL_API_TIMEOUT_SECONDS` | No | `60` | Request timeout in seconds. |

### Example `.env`

```env
MODEL_API_KEY=your_meta_api_key
MODEL_NAME=muse-spark-1.3
MODEL_API_BASE_URL=https://api.meta.ai/v1
MODEL_API_TIMEOUT_SECONDS=60
```

### Configuration Notes

- `MODEL_API_KEY` must contain a valid API credential.
- `MODEL_NAME` must identify a model available to the connected API account.
- `MODEL_API_BASE_URL` should point to the intended API endpoint.
- `MODEL_API_TIMEOUT_SECONDS` must be a positive number.

The backend loads model configuration from the root-level `.env` file.

The model client uses the configured values when initializing API requests.

## 4. Backend Setup

### Create a Virtual Environment

Using Python's built-in virtual environment:

```bash
python -m venv .venv
```

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

**Linux / macOS:**

```bash
source .venv/bin/activate
```

### Install Dependencies

From the repository root:

```bash
pip install -r backend/requirements.txt
```

### Start the Backend

```bash
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

### Verify Backend Health

```text
http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

### Interactive API Documentation

```text
http://127.0.0.1:8000/docs
```

## 5. Frontend Setup

Open another terminal.

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
```

## 6. Docker Configuration

Docker is required for repository execution workflows.

The execution environment is configured to apply restrictions to repository code execution.

The sandbox configuration includes controls such as:

- Network access disabled.
- Read-only filesystem.
- Non-root execution.
- Resource restrictions.
- Execution timeouts.
- Bounded command output.

Ensure the Docker daemon is running before starting repair workflows.

The exact sandbox image and runtime settings are defined in the backend sandbox implementation.

## 7. Repository Upload Configuration

Repository repair requests use ZIP archives.

Current upload constraints:

| Setting | Value |
|---|---|
| Maximum archive size | 25 MiB |
| Supported source language | Python |
| Test framework | Pytest |
| Required source files | At least one discoverable Python source file |
| Required test files | At least one discoverable pytest test file |

The backend validates the archive and analyzes its contents before scheduling a repair.

## 8. Storage and Runtime Data

The current MVP uses file-based JSON persistence.

Repair job information and reports are stored through the report storage service.

Repair conversation history is stored separately.

The application also uses temporary workspaces for uploaded repository processing.

Important deployment considerations:

- Preserve the persistent application data directory.
- Ensure the backend process has appropriate filesystem permissions.
- Do not place sensitive credentials in uploaded repositories.
- Back up repair reports and conversation data if they need to survive infrastructure changes.

The exact storage locations are defined by the backend storage implementation.

## 9. Development and Testing

### Backend Tests

Run from the repository root:

```bash
python -m pytest backend/tests -v
```

### Frontend Checks

Run from the frontend directory:

```bash
npm run
```

Use the available scripts defined in `frontend/package.json` for linting, type checking, and production builds.

### Recommended Development Workflow

1. Start Docker.
2. Activate the Python environment.
3. Start the FastAPI backend.
4. Start the Next.js frontend.
5. Confirm backend health.
6. Submit a controlled repair request.
7. Inspect the generated report and execution evidence.
8. Run the backend and frontend validation checks before committing changes.

## 10. Environment Security

Never commit secret environment files.

The root `.env` file should remain local and should not be included in public Git commits.

Use `.env.example` to document the required configuration variables without exposing real credentials.

For deployed environments, configure secrets through the hosting provider's environment variable management system.

Do not expose the Meta API key through frontend code or browser-accessible environment variables.

## 11. Production Deployment Considerations

Before deploying ProofLoop, review the following:

- Configure the production frontend origin in backend CORS settings.
- Configure model credentials through the hosting provider.
- Ensure Docker is available to the backend runtime.
- Use persistent storage for repair reports and conversations.
- Ensure the backend has sufficient memory, CPU, and disk resources.
- Review sandbox isolation before accepting untrusted public uploads.
- Verify health checks and API connectivity.
- Test the complete repair workflow in the deployed environment.

The current application uses file-based persistence and FastAPI background tasks. A multi-instance or horizontally scaled deployment will require additional shared-storage and job-processing considerations.