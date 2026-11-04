export type RepairStatus = "verified" | "unverified";

export type JobState =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface RepairSubmissionResponse {
  job_id: string;
  state: "queued";
  report_url: string;
}

export interface RepairJobResponse {
  job_id: string;
  state: JobState;
  created_at: string;
  updated_at: string;
  report: RepairReport | null;
  error: string | null;
}

export interface FileEditEvidence {
  path: string;
  old_text: string;
  new_text: string;
  explanation: string;
}

export interface ChangedFileEvidence {
  path: string;
  source_sha256_before: string;
  source_sha256_after: string;
}

export interface EvidenceEntry {
  step: string;

  failure_reproduced?: boolean | null;
  expected_failure?: string | null;

  success?: boolean | null;
  edits?: FileEditEvidence[] | null;

  source_path?: string | null;
  source_sha256?: string | null;
  source_sha256_before?: string | null;
  source_sha256_after?: string | null;

  changed_files?: ChangedFileEvidence[] | null;

  diff?: string | null;

  execution_id?: string | null;
  command?: string[] | null;
  exit_code?: number | null;
  timed_out?: boolean | null;
  tests_passed?: boolean | null;

  stdout?: string | null;
  stderr?: string | null;

  executor?: string | null;
  sandbox_image?: string | null;
  execution_started?: boolean | null;

  error_type?: string | null;
}

export interface RepairReport {
  project: string;
  timestamp_utc: string;
  status: RepairStatus;
  summary: string;
  evidence: EvidenceEntry[];

  root_cause?: string | null;
  changed_files?: ChangedFileEvidence[];

  patch_summary?: string | null;
  diff?: string | null;
  verification_scope?: string | string[] | null;
  error?: string | null;
}

export type ReportIntegrity =
  | "valid"
  | "invalid"
  | "not_available";

export interface RepairHistoryItem {
  job_id: string;
  state: JobState;
  created_at: string;
  updated_at: string | null;
  report_integrity: ReportIntegrity;
  report_status: RepairStatus | null;
  summary: string | null;
  error: string | null;
}

export type ConversationRole = "user" | "assistant";

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  content: string;
  created_at: string;
}

export interface ConversationResponse {
  job_id: string;
  messages: ConversationMessage[];
  reply: string | null;
}