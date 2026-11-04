"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CircleAlert,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Bot,
  ArrowRight,
} from "lucide-react";

import { getRepair } from "@/lib/api";
import type {
  JobState,
  RepairJobResponse,
} from "@/types/repair";

import ExecutionTimeline from "@/components/repair/execution-timeline";
import RepairResults from "@/components/repair/repair-results";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import RepairConversation from "@/components/repair/repair-conversation";

const POLL_INTERVAL = 2000;
const MAX_CONSECUTIVE_ERRORS = 5;

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

  const styles: Record<JobState, string> = {
    queued: "border-amber-300 bg-amber-50 text-amber-600",
    running: "border-violet-300 bg-violet-50 text-violet-600",
    completed: "border-green-300 bg-green-50 text-green-600",
    failed: "border-red-300 bg-red-50 text-red-600",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${styles[state]}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          state === "running" ? "animate-pulse" : ""
        } bg-current`}
      />
      {labels[state]}
    </span>
  );
}

function getHeading(job: RepairJobResponse | null) {
  if (!job) return "Loading repair";
  if (job.state === "queued") return "Waiting to execute";
  if (job.state === "running") return "Repair in progress";
  if (job.state === "completed") return "Repair completed";
  return "Repair execution failed";
}

function formatDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function RepairSession({ jobId }: RepairSessionProps) {
  const [job, setJob] = useState<RepairJobResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [manualRefresh, setManualRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let consecutiveErrors = 0;

    async function fetchRepair() {
      setLoading(true);
      try {
        const result = await getRepair(jobId, controller.signal);

        if (controller.signal.aborted) return;

        consecutiveErrors = 0;

        setJob(result);
        setError(null);
        setRetryCount(0);
        setLoading(false);

        if (result.state === "queued" || result.state === "running") {
          timeout = setTimeout(fetchRepair, POLL_INTERVAL);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        consecutiveErrors += 1;

        setError(
          err instanceof Error
            ? err.message
            : "Could not retrieve this repair session."
        );

        setRetryCount(consecutiveErrors);
        setLoading(false);

        if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
          timeout = setTimeout(
            fetchRepair,
            Math.min(POLL_INTERVAL * consecutiveErrors, 10000)
          );
        }
      }
    }

    void fetchRepair();

    return () => {
      controller.abort();

      if (timeout) clearTimeout(timeout);
    };
  }, [jobId, manualRefresh]);

  const active =
    !job || job.state === "queued" || job.state === "running";

  const updatedAt = formatDate(job?.updated_at);

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-6">
      {/* Navigation and status */}
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

{/* Session heading */}
<header className="space-y-4">
  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0180fa]">
    <span className="size-1.5 rounded-full bg-current" />
    Repair session
  </div>

  <div className="grid grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-8">
    {/* Left: Repair information */}
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold tracking-tight text-[#292724] sm:text-3xl">
        {getHeading(job)}
      </h1>

      <p className="mt-2 text-xs text-black/75">
        Job ID: <code className="select-all break-all">{jobId}</code>
      </p>

      {updatedAt && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-black/75">
          <Clock3 className="size-3" />
          Last updated {updatedAt}
        </p>
      )}

      {retryCount >= MAX_CONSECUTIVE_ERRORS && (
        <button
          type="button"
          onClick={() => setManualRefresh((value) => value + 1)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#EAE7E2] bg-white px-3 py-2 text-xs font-medium text-[#514D47] transition-colors hover:bg-[#F8F7F5]"
        >
          <RefreshCw className="size-3.5" />
          Retry connection
        </button>
      )}
    </div>

    {/* Right: Repair assistant */}
    {job?.state === "completed" && job.report && (
      <button
        type="button"
        onClick={() => {
          document
            .getElementById("repair-conversation")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });

          document.getElementById("repair-question-input")?.focus();
        }}
        className="group flex w-full items-center gap-4 rounded-2xl border border-[#D9CCFF] bg-gradient-to-r from-[#FAF8FF] via-[#F4EEFF] to-[#EEE7FF] p-4 text-left shadow-[0_4px_18px_rgba(113,101,197,0.08)] transition-all hover:-translate-y-0.5 hover:border-[#BBA8FF] hover:shadow-[0_8px_24px_rgba(113,101,197,0.15)] sm:p-5"
      >
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#9B7BFF] to-[#6846D9] text-white shadow-[0_5px_14px_rgba(104,70,217,0.3)]">
          <Bot className="size-8" strokeWidth={1.8} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold tracking-tight text-[#392477] sm:text-base">
            Ask about repair
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[#71618F]">
            Explore the diagnosis, understand the fix and verify the evidence.
          </p>
        </div>

        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#8056E8] text-white transition-transform group-hover:translate-x-1">
          <ArrowRight className="size-4" />
        </div>
      </button>
    )}
  </div>
</header>

      {/* Connection warning */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-xl border border-[#F0D4D1] bg-[#FFF8F7] p-4 text-[#9F3D35]"
          role="alert"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">
              Unable to retrieve the latest repair status
            </p>

            <p className="mt-1 text-xs leading-relaxed">{error}</p>

            {retryCount < MAX_CONSECUTIVE_ERRORS && (
              <p className="mt-2 text-[11px] text-[#A66B64]">
                Retrying connection ({retryCount}/{MAX_CONSECUTIVE_ERRORS})...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Initial loading */}
      {loading && !job ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-[#EAE7E2] bg-white">
          <LoaderCircle className="size-6 animate-spin text-[#7665D8]" />
          <p className="text-xs text-[#89847D]">
            Retrieving repair session...
          </p>
        </div>
      ) : job ? (
        <section className="space-y-4">
          {/* Active repair progress */}
          {active && (
            <div className="rounded-2xl border border-[#EAE7E2] bg-white p-5 shadow-[0_4px_20px_rgba(35,30,20,0.025)] sm:p-6">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-[#7665D8]" />

                <h2 className="text-sm font-semibold text-[#292724]">
                  Investigation in progress
                </h2>

                <LoaderCircle className="ml-auto size-4 animate-spin text-[#7665D8]" />
              </div>

              <p className="mt-1 text-xs text-[#89847D]">
                Follow the repair stages as ProofLoop investigates and tests the proposed fix.
              </p>

              <div className="mt-5">
                <ExecutionTimeline job={job} />
              </div>

              <p className="mt-4 rounded-xl bg-[#F8F6FF] px-4 py-3 text-xs leading-relaxed text-[#7163C7]">
                {job.state === "running"
                  ? "ProofLoop is executing the repair. New evidence will appear as the backend records it."
                  : "Your repair has been submitted and is waiting for execution to begin."}
              </p>
            </div>
          )}

          {/* Completed result takes priority */}
          {!active && (
            <>
              <RepairResults job={job} />

              {job.state === "completed" && !job.report && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Report unavailable
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    The repair job completed, but its report could not be retrieved.
                  </p>
                </div>
              )}
              {job.state === "completed" && job.report && (
                <RepairConversation jobId={jobId} />
              )}
            </>
          )}

          {/* Compact expandable execution timeline */}
          <div className="rounded-xl border border-[#EAE7E2] shadow-sm bg-white px-4">
            <Accordion className="w-full">
              <AccordionItem value="execution-timeline" className="border-b-0">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="flex min-w-0 items-center gap-3 text-left">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F1EC] text-[#7165C5]">
                      <Activity className="size-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#292724]">
                        Execution timeline
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#89847D]">
                        Inspect investigation stages and progress
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="border-t border-[#EAE7E2] pb-4 pt-4">
                    <ExecutionTimeline job={job} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-[#EAE7E2] bg-white p-6 text-center">
          <CircleAlert className="mx-auto size-6 text-[#A66B64]" />

          <h2 className="mt-3 text-sm font-semibold text-[#292724]">
            Repair session unavailable
          </h2>

          <p className="mt-1 text-xs text-[#89847D]">
            We couldn&apos;t retrieve this repair. Check your connection and try again.
          </p>

          <button
            type="button"
            onClick={() => setManualRefresh((value) => value + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#EAE7E2] px-3 py-2 text-xs font-medium text-[#514D47] hover:bg-[#F8F7F5]"
          >
            <RefreshCw className="size-3.5" />
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
