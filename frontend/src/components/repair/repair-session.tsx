
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";

import { getRepair } from "@/lib/api";
import type {
  JobState,
  RepairJobResponse,
} from "@/types/repair";

import ExecutionTimeline from "@/components/repair/execution-timeline";
import RepairResults from "@/components/repair/repair-results";

const POLL_INTERVAL = 2000;

interface RepairSessionProps {
  jobId: string;
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

export default function RepairSession({ jobId }: RepairSessionProps) {
  const [job, setJob] = useState<RepairJobResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function fetchRepair() {
      try {
        const result = await getRepair(jobId, controller.signal);

        if (controller.signal.aborted) return;

        setJob(result);
        setError(null);
        setLoading(false);

        if (result.state === "queued" || result.state === "running") {
          timeout = setTimeout(fetchRepair, POLL_INTERVAL);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not retrieve this repair session."
        );
        setLoading(false);

        // Retry transient errors while the session has not reached
        // a terminal state or its status is not yet known.
        timeout = setTimeout(fetchRepair, POLL_INTERVAL);
      }
    }

    void fetchRepair();

    return () => {
      controller.abort();

      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [jobId]);

  const active =
    job === null ||
    job.state === "queued" ||
    job.state === "running";

  const heading = !job
    ? "Loading repair"
    : job.state === "queued"
      ? "Waiting to execute"
      : job.state === "running"
        ? "Repair in progress"
        : job.state === "completed"
          ? "Repair completed"
          : "Repair failed";

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-[#817B73] transition-colors hover:text-[#292724]"
        >
          <ArrowLeft className="size-3.5" />
          Back to overview
        </Link>

        {job && <StateBadge state={job.state} />}
      </div>

      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7665D8]">
          <span className="size-1.5 rounded-full bg-current" />
          Repair session
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-[#292724] sm:text-3xl">
          {heading}
        </h1>

        <p className="text-xs text-[#89847D]">
          Job ID: <code className="select-all">{jobId}</code>
        </p>
      </header>

      {error && (
        <div
          className="flex items-start gap-3 rounded-xl border border-[#F0D4D1] bg-[#FFF8F7] p-4 text-[#9F3D35]"
          role="alert"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold">
              Unable to retrieve the latest repair status
            </p>
            <p className="mt-1 text-xs leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {loading && !job ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-[#EAE7E2] bg-white">
          <LoaderCircle className="size-6 animate-spin text-[#7665D8]" />
          <p className="text-xs text-[#89847D]">
            Retrieving repair session...
          </p>
        </div>
      ) : (
        <section className="space-y-5">
          <div className="rounded-2xl border border-[#EAE7E2] bg-white p-5 shadow-[0_4px_20px_rgba(35,30,20,0.025)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#89847D]">
                  Execution activity
                </p>
                <h2 className="mt-1 text-sm font-semibold text-[#292724]">
                  Investigation pipeline
                </h2>
              </div>

              {active && (
                <LoaderCircle className="size-4 animate-spin text-[#7665D8]" />
              )}
            </div>

            <div className="mt-5">
              <ExecutionTimeline job={job} />
            </div>

            {active && (
              <p className="mt-4 rounded-xl bg-[#F8F6FF] px-4 py-3 text-xs leading-relaxed text-[#7163C7]">
                {job?.state === "running"
                  ? "ProofLoop is executing the repair. The session will update as the backend records new evidence."
                  : "Your repair has been submitted. Waiting for execution to begin."}
              </p>
            )}
          </div>

          {job && <RepairResults job={job} />}
        </section>
      )}
    </div>
  );
}
