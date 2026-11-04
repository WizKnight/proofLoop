# ProofLoop - Security and Execution Isolation

## 1. Overview

ProofLoop accepts Python repository archives, generates proposed code patches, and executes repository tests inside a Docker-based environment.

Uploaded repositories must be treated as untrusted input because their source code and test suites can contain arbitrary executable instructions.

Security is therefore an important part of the repair workflow.

ProofLoop uses archive validation, temporary workspaces, and restricted Docker execution to reduce risks associated with processing and executing uploaded repositories.

The current security model is designed for the MVP and requires additional review before accepting untrusted public traffic.

## 2. Security Principles

| Principle | Description |
|---|---|
| Treat uploads as untrusted | Repository archives and their contents must not be trusted. |
| Validate before execution | Uploaded repositories are inspected before repair execution is scheduled. |
| Isolate execution | Repository tests run inside a restricted Docker environment. |
| Limit resource consumption | Execution time and resource usage are restricted. |
| Protect credentials | API credentials must remain outside uploaded repositories and frontend code. |
| Preserve evidence | Repair execution results and reports are retained for inspection. |

## 3. Repository Upload Validation

ProofLoop validates uploaded repository archives before scheduling repair jobs.

The upload workflow includes:

1. Read the uploaded archive incrementally.
2. Enforce the maximum archive size.
3. Reject empty archives.
4. Extract the archive into a temporary workspace.
5. Analyze the extracted repository.
6. Check for discoverable Python source files.
7. Check for discoverable pytest test files.
8. Create a repair job only after validation succeeds.

### Upload Constraints

| Setting | Current behavior |
|---|---|
| Maximum archive size | 25 MiB |
| Archive format | ZIP |
| Source language | Python |
| Test framework | Pytest |
| Source validation | At least one discoverable Python source file |
| Test validation | At least one discoverable pytest test file |

Invalid archives and repositories that do not meet the required validation conditions are rejected before repair execution is scheduled.

## 4. Temporary Workspace Management

Uploaded repositories are extracted into temporary workspaces.

The workspace provides the working context for repository analysis and repair execution.

The upload workflow transfers workspace ownership to the background repair task after successful job creation.

The workspace is cleaned up when repository repair processing finishes.

This helps prevent temporary uploaded repository contents from being retained indefinitely in the processing workspace.

Repair reports and conversation information are persisted separately from the temporary repository workspace.

## 5. Docker Execution Isolation

Repository code is executed inside a Docker-based sandbox.

The execution environment is configured with restrictions designed to reduce the impact of untrusted code.

### Current Sandbox Controls

| Control | Purpose |
|---|---|
| Network disabled | Prevents repository execution from accessing external network resources. |
| Read-only filesystem | Restricts filesystem modification outside permitted writable locations. |
| Non-root execution | Avoids running repository code with container root privileges. |
| Resource limits | Restricts resource consumption. |
| Execution timeout | Prevents indefinitely running commands. |
| Bounded output | Limits excessive execution output. |
| No host Python fallback | Prevents silently executing repository tests outside the Docker environment. |

These controls are intended to reduce execution risks.

They should not be interpreted as a guarantee that arbitrary repository code is completely safe.

## 6. Model API Credential Protection

ProofLoop uses Meta's Model API for AI-assisted investigation, patch generation, and repair conversations.

The backend reads model configuration from the root-level `.env` file.

Required credential:

```env
MODEL_API_KEY=your_meta_api_key
```

Security requirements:

- Never commit `.env` to the public repository.
- Never expose the model API key through frontend code.
- Do not include API credentials in uploaded repositories.
- Use `.env.example` to document configuration without exposing real credentials.
- Configure production secrets through the hosting provider's environment variable management system.
- Rotate credentials if they are accidentally exposed.

## 7. API and Application Security Considerations

The backend exposes REST endpoints for repair submission, repository uploads, repair history, and repair conversations.

Before exposing the application publicly, review the following areas.

### CORS

The current development configuration permits:

```text
http://localhost:3000
```

Production deployment must configure the exact frontend origin.

Avoid using unrestricted wildcard origins.

### API Access Control

The current API implementation should not be assumed to provide user authentication or authorization.

Before accepting public traffic, consider:

- Authentication for repair submission.
- Authorization for accessing repair jobs.
- Ownership checks for repair reports and conversations.
- Rate limiting for model-backed operations.
- Upload abuse prevention.
- Request size and execution quotas.

### Persistent Data

Repair reports and conversation history are persisted by the backend.

Production deployment should consider:

- Restricting filesystem access.
- Protecting stored repair reports.
- Backing up important data.
- Avoiding public exposure of application data directories.
- Defining retention and deletion policies.

## 8. Threat Boundaries

ProofLoop processes repository code that it does not control.

Potential risks include:

| Threat | Potential impact | Relevant protection |
|---|---|---|
| Malicious repository code | Unauthorized operations during execution | Restricted Docker environment |
| Oversized archive | Excessive memory or disk consumption | 25 MiB upload limit |
| Excessive test execution | Resource exhaustion | Resource limits and timeouts |
| Excessive command output | Memory or storage pressure | Bounded output |
| Credential exposure | Unauthorized API usage | Backend-only credential configuration |
| Malicious API usage | Excessive repair jobs or model costs | Requires production access controls and rate limiting |
| Unauthorized report access | Exposure of repair information | Requires production authentication and authorization |

## 9. Production Security Checklist

Before opening ProofLoop to public users, review and validate:

- [ ] Docker sandbox configuration.
- [ ] Container isolation and writable filesystem boundaries.
- [ ] Resource and execution limits.
- [ ] ZIP extraction protections.
- [ ] Upload size enforcement.
- [ ] API authentication and authorization.
- [ ] Repair job ownership checks.
- [ ] Rate limiting and abuse prevention.
- [ ] Production CORS configuration.
- [ ] Secret management.
- [ ] Persistent storage permissions.
- [ ] Report and conversation data protection.
- [ ] Dependency and container image vulnerabilities.
- [ ] Logging and error information exposure.

## 10. Security Limitations

Docker provides an isolation boundary, but it is not an absolute security guarantee.

The current MVP should not be treated as a fully hardened public code execution platform.

Additional security review is necessary before processing arbitrary third-party repositories at scale.

In particular:

- Container isolation must be tested against malicious workloads.
- API endpoints need appropriate access controls before public exposure.
- Persistent data requires appropriate access restrictions.
- Resource limits must be validated under hostile workloads.
- Production deployment must not expose Docker management interfaces to untrusted users.

## 11. Security Philosophy

ProofLoop follows two important principles:

**Untrusted code must be isolated before execution.**

**A successful repair must be supported by execution evidence rather than AI-generated claims.**

Security and verification are complementary responsibilities. Evidence-backed repair does not replace the need for secure execution, access control, and independent code review.