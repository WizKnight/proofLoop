
"use client";

import { useEffect, useState } from "react";
import { getRepair, submitRepair } from "@/lib/api";
import type { FormEvent } from "react";
import type {
  EvidenceEntry,
  JobState,
  RepairJobResponse,
} from "@/types/repair";

const POLL_INTERVAL = 2000;

const stages = [
  { id: "baseline_tests", label: "Baseline tests" },
  { id: "patch_generation", label: "Patch generation" },
  { id: "patch_application", label: "Patch application" },
  { id: "post_patch_tests", label: "Post-patch tests" },
];

function formatStage(step: string) {
  return (
    stages.find((stage) => stage.id === step)?.label ??
    step.replaceAll("_", " ")
  );
}

function StateBadge({ state }: { state: JobState }) {
  const labels: Record<JobState, string> = {
    queued: "Queued",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
  };

  return (
    <span className={`job-badge job-badge-${state}`}>
      <span className="job-badge-dot" />
      {labels[state]}
    </span>
  );
}

function EvidenceCard({ entry }: { entry: EvidenceEntry }) {
  return (
    <details className="evidence-card">
      <summary>
        <span className="evidence-step">
          {formatStage(entry.step)}
        </span>
        <span className="evidence-expand">View details</span>
      </summary>

      <div className="evidence-content">
        {entry.execution_id && (
          <div className="evidence-field">
            <span>Execution ID</span>
            <code>{entry.execution_id}</code>
          </div>
        )}

        {entry.executor && (
          <div className="evidence-field">
            <span>Executor</span>
            <strong>{entry.executor}</strong>
          </div>
        )}

        {entry.exit_code !== undefined && (
          <div className="evidence-field">
            <span>Exit code</span>
            <strong>{entry.exit_code ?? "Not available"}</strong>
          </div>
        )}

        {entry.timed_out !== undefined && (
          <div className="evidence-field">
            <span>Timed out</span>
            <strong>{entry.timed_out ? "Yes" : "No"}</strong>
          </div>
        )}

        {entry.source_sha256 && (
          <div className="evidence-field">
            <span>Source SHA-256</span>
            <code>{entry.source_sha256}</code>
          </div>
        )}

        {entry.source_sha256_before && (
          <div className="evidence-field">
            <span>SHA-256 before</span>
            <code>{entry.source_sha256_before}</code>
          </div>
        )}

        {entry.source_sha256_after && (
          <div className="evidence-field">
            <span>SHA-256 after</span>
            <code>{entry.source_sha256_after}</code>
          </div>
        )}

        {entry.command && (
          <div className="evidence-output">
            <span>Execution command</span>
            <pre>{entry.command.join(" ")}</pre>
          </div>
        )}

        {entry.stdout && (
          <div className="evidence-output">
            <span>Standard output</span>
            <pre>{entry.stdout}</pre>
          </div>
        )}

        {entry.stderr && (
          <div className="evidence-output">
            <span>Standard error</span>
            <pre>{entry.stderr}</pre>
          </div>
        )}

        {entry.diff && (
          <div className="evidence-output">
            <span>Patch diff</span>
            <pre>{entry.diff}</pre>
          </div>
        )}
      </div>
    </details>
  );
}

function RepairResult({
  job,
}: {
  job: RepairJobResponse;
}) {
  const report = job.report;

  if (job.state === "failed") {
    return (
      <section className="result-panel result-failed">
        <div className="result-heading">
          <span className="result-icon">!</span>
          <div>
            <h2>Repair job failed</h2>
            <p>{job.error ?? "The repair could not be completed."}</p>
          </div>
        </div>
      </section>
    );
  }

  if (job.state !== "completed" || !report) {
    return null;
  }

  const verified = report.status === "verified";
  const scope = report.verification_scope;

  return (
    <section className="result-section">
      <div
        className={`result-panel ${
          verified ? "result-verified" : "result-unverified"
        }`}
      >
        <div className="result-heading">
          <span className="result-icon">
            {verified ? "✓" : "!"}
          </span>

          <div className="result-main">
            <span className="result-eyebrow">
              Verification result
            </span>
            <h2>{verified ? "Fix verified" : "Fix unverified"}</h2>
            <p>{report.summary}</p>
          </div>

          <span
            className={`verification-badge ${
              verified ? "verification-success" : "verification-warning"
            }`}
          >
            {report.status}
          </span>
        </div>
      </div>

      {report.patch_summary && (
        <div className="result-block">
          <h3>Patch summary</h3>
          <p>{report.patch_summary}</p>
        </div>
      )}

      {report.diff && (
        <div className="result-block">
          <h3>Source changes</h3>
          <pre className="patch-diff">{report.diff}</pre>
        </div>
      )}

      <div className="result-block">
        <div className="result-block-heading">
          <h3>Execution evidence</h3>
          <span>{report.evidence.length} recorded steps</span>
        </div>

        <div className="evidence-list">
          {report.evidence.map((entry, index) => (
            <EvidenceCard
              key={`${entry.step}-${index}`}
              entry={entry}
            />
          ))}
        </div>
      </div>

      {scope && (
        <div className="verification-scope">
          <strong>Verification scope</strong>
          <p>
            {Array.isArray(scope) ? scope.join(" ") : scope}
          </p>
        </div>
      )}

      {report.error && (
        <div className="verification-scope">
          <strong>Additional information</strong>
          <p>{report.error}</p>
        </div>
      )}
    </section>
  );
}

interface RepairWorkspaceProps {
  historyJobId: string | null;
  onHistorySelectionCleared: () => void;
}

export default function RepairWorkspace({
  historyJobId,
  onHistorySelectionCleared,
}: RepairWorkspaceProps) {
  const [bugReport, setBugReport] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<RepairJobResponse | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active =
    jobId !== null &&
    (job === null || job.state === "queued" || job.state === "running");

  useEffect(() => {
  if (!historyJobId) return;
  const selectedJobId = historyJobId;

  const controller = new AbortController();

  async function loadHistoricalJob() {
    try {
      const historicalJob = await getRepair(
        selectedJobId,
        controller.signal
      );

      if (controller.signal.aborted) return;

      setError(null);
      setJob(historicalJob);
      setJobId(selectedJobId);
    } catch (err) {
      if (controller.signal.aborted) return;

      setError(
        err instanceof Error
          ? err.message
          : "Could not load historical repair report."
      );
    }
  }

  void loadHistoricalJob();

  return () => controller.abort();
}, [historyJobId]);

  useEffect(() => {
    if (!active || jobId === null) return;

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const updatedJob = await getRepair(
          jobId,
          controller.signal
        );

        if (controller.signal.aborted) return;

        setJob(updatedJob);

        if (
          updatedJob.state === "queued" ||
          updatedJob.state === "running"
        ) {
          timeout = setTimeout(poll, POLL_INTERVAL);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not retrieve repair status."
        );
      }
    };

    void poll();

    return () => {
      controller.abort();

      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [jobId, active]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const description = bugReport.trim();

    if (description.length < 10 || description.length > 4000) {
      return;
    }

    setSubmitting(true);
    setError(null);
    onHistorySelectionCleared();
    setJob(null);
    setJobId(null);

    try {
      const response = await submitRepair(description);

      setJobId(response.job_id);
      setBugReport("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit the repair request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section
        className="composer"
        aria-labelledby="composer-heading"
      >
        <form onSubmit={handleSubmit}>
          <div className="composer-header">
            <label
              className="composer-title"
              id="composer-heading"
              htmlFor="bug-report"
            >
              New repair
            </label>
            <span className="composer-hint">
              Describe the issue in plain language
            </span>
          </div>

          <textarea
            id="bug-report"
            value={bugReport}
            onChange={(event) => setBugReport(event.target.value)}
            placeholder={`Describe the bug, what you expected to happen, and what actually happened...

Example: calculate_discount returns the original price when discount_percent is 100. A full discount should return zero.`}
            minLength={10}
            maxLength={4000}
            required
            disabled={submitting || active}
          />

          <div className="composer-footer">
            <div className="composer-meta">
              <span>Python project</span>
              <span className="meta-separator">·</span>
              <span>{bugReport.length.toLocaleString()} / 4,000</span>
            </div>

            <button
              className="composer-button"
              type="submit"
              disabled={
                submitting ||
                active ||
                bugReport.trim().length < 10
              }
            >
              {submitting ? "Submitting..." : "Start repair"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="api-error" role="alert">
          <strong>Something went wrong</strong>
          <p>{error}</p>
        </div>
      )}

      {jobId && (
        <section className="live-job" aria-live="polite">
          <div className="live-job-heading">
            <div>
              <span className="result-eyebrow">REPAIR EXECUTION</span>
               <h2>
                {!job
                    ? "Submitting repair"
                    : job.state === "queued"
                        ? "Waiting to execute"
                        : job.state === "running"
                            ? "Repair in progress"
                            : job.state === "completed"
                                ? "Repair completed"
                                : "Repair failed"}
                </h2>
            </div>

            {job ? (
              <StateBadge state={job.state} />
            ) : (
              <StateBadge state="queued" />
            )}
          </div>

          <div className="job-id">
            Job ID <code>{jobId}</code>
          </div>

          {active && (
            <p className="job-progress">
              {job?.state === "running"
                ? "The repair is executing. Waiting for the backend to persist its report..."
                : "Your repair has been submitted. Waiting for execution to begin..."}
            </p>
          )}

          {job && <RepairResult job={job} />}
        </section>
      )}
    </>
  );
}
