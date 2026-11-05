import type {
  RepairHistoryItem,
  RepairJobResponse,
  RepairSubmissionResponse,
  ConversationMessage,
  ConversationResponse,
} from "@/types/repair";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? ""
).replace(/\/+$/, "");


function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/**
 * Send requests to the local ProofLoop backend.
 */
async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    headers: new Headers(init.headers),
  });
}

async function parseResponse<T>(
  response: Response
): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.detail ??
      `Request failed with status ${response.status}`;

    throw new Error(
      typeof message === "string"
        ? message
        : "The request could not be completed."
    );
  }

  if (data === null) {
    throw new Error("The backend returned an invalid response.");
  }

  return data as T;
}

/**
 * Submit a repair using the built-in demo fixture.
 */
export async function submitRepair(
  bugReport: string
): Promise<RepairSubmissionResponse> {
  const response = await apiFetch("/api/v1/repairs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bug_report: bugReport,
    }),
  });

  return parseResponse<RepairSubmissionResponse>(response);
}

/**
 * Submit a repair for an uploaded Python repository.
 *
 * The browser automatically sets the multipart boundary.
 * Do not manually set Content-Type for FormData.
 */
export async function submitRepositoryRepair(
  repository: File,
  bugReport: string,
  expectedFailure: string
): Promise<RepairSubmissionResponse> {
  const formData = new FormData();

  formData.append("repository", repository);
  formData.append("bug_report", bugReport);
  formData.append("expected_failure", expectedFailure);

  const response = await apiFetch(
    "/api/v1/repairs/repository",
    {
      method: "POST",
      body: formData,
    }
  );

  return parseResponse<RepairSubmissionResponse>(response);
}

/**
 * Retrieve an individual repair job and its report.
 */
export async function getRepair(
  jobId: string,
  signal?: AbortSignal
): Promise<RepairJobResponse> {
  const response = await apiFetch(
    `/api/v1/repairs/${encodeURIComponent(jobId)}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    }
  );

  return parseResponse<RepairJobResponse>(response);
}

/**
 * Check whether the FastAPI backend is reachable.
 * This endpoint intentionally remains public.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(
      apiUrl("/health"),
      {
        method: "GET",
        cache: "no-store",
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Retrieve recent repair jobs.
 */
export async function listRepairs(
  limit = 20,
  signal?: AbortSignal
): Promise<RepairHistoryItem[]> {
  const safeLimit = Math.max(
    1,
    Math.min(Math.floor(limit), 100)
  );

  const response = await apiFetch(
    `/api/v1/repairs?limit=${safeLimit}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    }
  );

  return parseResponse<RepairHistoryItem[]>(response);
}

/**
 * Retrieve persisted conversation history for a repair.
 */
export async function getRepairConversation(
  jobId: string,
  signal?: AbortSignal
): Promise<ConversationMessage[]> {
  const response = await apiFetch(
    `/api/v1/repairs/${encodeURIComponent(jobId)}/conversation`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    }
  );

  return parseResponse<ConversationMessage[]>(response);
}

/**
 * Send a question to the ProofLoop Repair Assistant.
 */
export async function sendRepairMessage(
  jobId: string,
  message: string,
  clientRequestId: string
): Promise<ConversationResponse> {
  const response = await apiFetch(
    `/api/v1/repairs/${encodeURIComponent(jobId)}/conversation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        client_request_id: clientRequestId,
      }),
    }
  );

  return parseResponse<ConversationResponse>(response);
}
