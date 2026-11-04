# ProofLoop - API Reference

## 1. Overview

ProofLoop exposes a REST API through its FastAPI backend.

The API allows developers to:

- Check backend health.
- Submit repair requests.
- Upload Python repositories for repair.
- Retrieve repair job information.
- Retrieve repair history.
- Ask questions about completed repairs.
- Retrieve repair conversation history.

**Base URL (local development):**

```text
http://127.0.0.1:8000
```

Interactive API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

The OpenAPI specification is available at:

```text
http://127.0.0.1:8000/openapi.json
```

## 2. Endpoint Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Check backend health. |
| POST | `/api/v1/repairs` | Submit a built-in fixture repair request. |
| POST | `/api/v1/repairs/repository` | Upload a Python repository for repair. |
| GET | `/api/v1/repairs/{job_id}` | Retrieve repair job details. |
| GET | `/api/v1/repairs?limit=20` | Retrieve repair history. |
| POST | `/api/v1/repairs/{job_id}/conversation` | Send a message to the Repair Assistant. |
| GET | `/api/v1/repairs/{job_id}/conversation` | Retrieve conversation history. |

## 3. Health

### `GET /health`

Checks whether the backend API process is responsive.

**Example request:**

```http
GET /health
```

**Successful response:**

```json
{
  "status": "ok"
}
```

## 4. Submit a Fixture Repair

### `POST /api/v1/repairs`

Creates a repair job using the built-in ProofLoop demonstration fixture.

**Content-Type:** `application/json`

**Request body:**

```json
{
  "bug_report": "The discount calculator returns the original price when the discount is 100%. It should return zero."
}
```

Request constraints:

| Field | Type | Constraint |
|---|---|---|
| `bug_report` | String | Minimum 10 characters, maximum 4,000 characters |

Additional unknown fields are rejected.

**Successful response:**

HTTP `201 Created`

```json
{
  "job_id": "generated-job-uuid",
  "state": "queued",
  "report_url": "/api/v1/repairs/generated-job-uuid"
}
```

The response provides a job identifier and a relative URL for retrieving the repair job.

The job is scheduled for background execution.

## 5. Upload a Repository for Repair

### `POST /api/v1/repairs/repository`

Uploads a Python repository archive and schedules an evidence-driven repair.

**Content-Type:** `multipart/form-data`

**Form fields:**

| Field | Type | Description |
|---|---|---|
| `repository` | File | Python repository ZIP archive. |
| `bug_report` | String | Description of the reported bug. |
| `expected_failure` | String | Expected failing pytest identifier. |

Constraints:

- `bug_report`: 10–4,000 characters.
- `expected_failure`: 1–300 characters.
- Maximum uploaded archive size: 25 MiB.
- Repository must contain discoverable Python source files.
- Repository must contain discoverable pytest test files.

The backend validates and extracts the uploaded archive before scheduling the repair job.

**Example using cURL:**

```bash
curl -X POST http://127.0.0.1:8000/api/v1/repairs/repository \
  -F "repository=@demo-project.zip" \
  -F "bug_report=The pagination function skips the first item on subsequent pages." \
  -F "expected_failure=test_second_page"
```

**Successful response:**

HTTP `201 Created`

```json
{
  "job_id": "generated-job-uuid",
  "state": "queued",
  "report_url": "/api/v1/repairs/generated-job-uuid"
}
```

## 6. Retrieve a Repair Job

### `GET /api/v1/repairs/{job_id}`

Retrieves the latest state and report for a repair job.

**Path parameter:**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | UUID | Identifier returned when the repair job was created. |

**Example request:**

```http
GET /api/v1/repairs/00000000-0000-0000-0000-000000000000
```

The response contains the persisted job information and, when available, the validated repair report.

Possible job states:

| State | Meaning |
|---|---|
| `queued` | Waiting for execution. |
| `running` | Repair workflow is executing. |
| `completed` | Repair workflow finished and its result was persisted. |
| `failed` | Repair job could not be completed. |

**Important:** A `completed` job does not necessarily represent a verified repair. Verification status is determined separately by the repair report.

**Error responses:**

| HTTP status | Meaning |
|---|---|
| `404` | Repair job not found. |
| `500` | Saved job could not be retrieved or validated. |

For the complete response schema, consult `/docs`.

## 7. Retrieve Repair History

### `GET /api/v1/repairs`

Returns recent repair jobs.

**Query parameters:**

| Parameter | Type | Default | Constraints |
|---|---|---|---|
| `limit` | Integer | 20 | Minimum 1, maximum 100 |

**Example request:**

```http
GET /api/v1/repairs?limit=20
```

The response is a list of repair history entries.

History information can include:

- Job identifier.
- Job state.
- Creation timestamp.
- Update timestamp.
- Error information.
- Report integrity status.
- Repair status and summary when the stored report is valid.

Stored reports are independently validated before their report status is exposed through history.

## 8. Repair Assistant

The Repair Assistant allows developers to ask questions about a completed repair.

It uses the saved repair report and conversation history as context.

Conversation requests are available only after the repair job completes.

### `POST /api/v1/repairs/{job_id}/conversation`

Sends a message to the Repair Assistant.

**Content-Type:** `application/json`

**Example request:**

```json
{
  "message": "Why was this repair marked verified?",
  "client_request_id": "00000000-0000-4000-8000-000000000001"
}
```

The `client_request_id` is used for request deduplication when supplied.

The backend prevents reuse of the same request ID with different message content.

The conversation has a maximum of 40 stored messages per repair session. Individual messages are limited to 4,000 characters.

**Successful response:**

The response contains:

- Repair job identifier.
- The submitted user message.
- The generated assistant reply.
- The reply content.

The exact response schema is available through `/docs`.

**Possible errors:**

| HTTP status | Meaning |
|---|---|
| `404` | Repair session not found. |
| `409` | Repair is incomplete, report is unavailable, conversation limit reached, or request ID conflicts with an existing message. |
| `422` | Invalid request or request ID. |
| `502` | Repair Assistant could not generate a response. |

### `GET /api/v1/repairs/{job_id}/conversation`

Retrieves the saved conversation history for a completed repair session.

**Example request:**

```http
GET /api/v1/repairs/00000000-0000-0000-0000-000000000000/conversation
```

The response is a list of conversation messages.

The conversation is persisted separately from the repair report.

**Possible errors:**

| HTTP status | Meaning |
|---|---|
| `404` | Repair session not found. |
| `409` | Repair has not completed. |
| `500` | Conversation history could not be loaded. |

## 9. Background Job Execution

Repair submission endpoints return a job identifier before the repair workflow finishes.

The job lifecycle is:

```text
Request Submitted
       |
       v
     Queued
       |
       v
     Running
       |
       v
 Completed / Failed
```

Clients can use the returned `job_id` to retrieve the latest job state.

A completed job can contain either a verified or an unsuccessful repair report.

## 10. Error Handling

The API uses HTTP status codes to distinguish request validation failures, missing resources, conflicts, and server errors.

Common responses include:

| HTTP status | Description |
|---|---|
| `201` | Resource created or repair job submitted. |
| `400` | Invalid or empty repository archive. |
| `404` | Requested job or session not found. |
| `409` | Operation conflicts with the current job or conversation state. |
| `413` | Repository archive exceeds the upload limit. |
| `422` | Request validation or repository validation failed. |
| `500` | Internal server or persistence error. |
| `502` | Repair Assistant generation failure. |

## 11. Interactive API Documentation

The FastAPI backend generates an OpenAPI specification.

Start the backend and visit:

```text
http://127.0.0.1:8000/docs
```

Use the interactive interface to inspect request schemas, response schemas, and available operations.

The live OpenAPI specification should be treated as the authoritative source for exact request and response models.