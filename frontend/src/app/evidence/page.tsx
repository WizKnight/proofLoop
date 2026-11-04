"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileCode2,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { getRepair, listRepairs } from "@/lib/api";
import type {
  EvidenceEntry,
  RepairHistoryItem,
  RepairJobResponse,
} from "@/types/repair";

type StageFilter =
  | "all"
  | "baseline_tests"
  | "patch_generation"
  | "patch_application"
  | "post_patch_tests";

const STAGES: { label: string; value: StageFilter }[] = [
  { label: "All stages", value: "all" },
  { label: "Baseline tests", value: "baseline_tests" },
  { label: "Patch generation", value: "patch_generation" },
  { label: "Patch application", value: "patch_application" },
  { label: "Regression tests", value: "post_patch_tests" },
];

function getTitle(item: RepairHistoryItem) {
  const summary = item.summary?.trim();

  if (
    summary &&
    summary.length <= 75 &&
    !summary.toLowerCase().startsWith("the baseline failure was reproduced")
  ) {
    return summary;
  }

  return `Repair ${item.job_id.slice(0, 8)}`;
}

function getSessionStatus(item: RepairHistoryItem) {
  if (item.state === "queued") {
    return {
      label: "Queued",
      className: "bg-stone-100 text-stone-600",
      icon: Clock3,
    };
  }

  if (item.state === "running") {
    return {
      label: "Running",
      className: "bg-violet-50 text-violet-700",
      icon: LoaderCircle,
    };
  }

  if (item.state === "failed") {
    return {
      label: "Failed",
      className: "bg-red-50 text-red-700",
      icon: XCircle,
    };
  }

  if (item.report_integrity === "invalid") {
    return {
      label: "Invalid report",
      className: "bg-red-50 text-red-700",
      icon: ShieldAlert,
    };
  }

  if (item.report_status === "verified") {
    return {
      label: "Verified",
      className: "bg-emerald-50 text-emerald-500",
      icon: ShieldCheck,
    };
  }

  return {
    label: "Unverified",
    className: "bg-amber-50 text-amber-500",
    icon: AlertCircle,
  };
}

function getStageLabel(step: string) {
  const labels: Record<string, string> = {
    baseline_tests: "Baseline tests",
    patch_generation: "Patch generation",
    patch_application: "Patch application",
    post_patch_tests: "Regression tests",
  };

  return labels[step] ?? step.replaceAll("_", " ");
}

function getEvidenceOutcome(entry: EvidenceEntry) {
  if (entry.step === "baseline_tests" && entry.failure_reproduced === true) {
    return {
      label: "Failure reproduced",
      className: "bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }

  if (entry.step === "post_patch_tests" && entry.tests_passed === true) {
    return {
      label: "Tests passed",
      className: "bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }

  if (entry.timed_out) {
    return {
      label: "Timed out",
      className: "bg-red-50 text-red-500",
      icon: AlertCircle,
    };
  }

  if (entry.exit_code != null && entry.exit_code !== 0) {
    return {
      label: `Exit ${entry.exit_code}`,
      className: "bg-amber-50 text-amber-500",
      icon: AlertCircle,
    };
  }

  if (entry.success === true || entry.exit_code === 0) {
    return {
      label: "Successful",
      className: "bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }

  return {
    label: "Recorded",
    className: "bg-stone-100 text-stone-600",
    icon: FileText,
  };
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function EvidenceRecord({ entry }: {
  entry: EvidenceEntry;
}) {
  const [expanded, setExpanded] = useState(false);

  const outcome = getEvidenceOutcome(entry);
  const OutcomeIcon = outcome.icon;

  const hasDetails = Boolean(
    entry.command?.length ||
    entry.stdout ||
    entry.stderr ||
    entry.diff ||
    entry.source_sha256 ||
    entry.changed_files?.length ||
    entry.execution_id ||
    entry.error_type
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#EAE7E2] bg-white">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[#FAF9F7]"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F4F1EC] text-[#7165C5]">
          <Terminal className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold capitalize text-[#34312D]">
            {getStageLabel(entry.step)}
          </p>

          <p className="mt-1 truncate text-[11px] text-[#89847D]">
            {entry.executor ?? "Execution record"}
            {entry.execution_id ? ` · ${entry.execution_id}` : ""}
          </p>
        </div>

        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${outcome.className}`}>
          <OutcomeIcon className="size-3" />
          {outcome.label}
        </span>

        <span className="ml-1 text-[10px] text-[#89847D]">
          {expanded ? "-" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-[#EAE7E2] p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entry.executor && (
              <Metadata label="Executor" value={entry.executor} />
            )}

            {entry.exit_code !== undefined && (
              <Metadata
                label="Exit code"
                value={entry.exit_code === null ? "Not available" : String(entry.exit_code)}
              />
            )}

            {entry.timed_out !== undefined && (
              <Metadata
                label="Timed out"
                value={entry.timed_out ? "Yes" : "No"}
              />
            )}

            {entry.execution_started !== undefined && (
              <Metadata
                label="Execution started"
                value={entry.execution_started ? "Yes" : "No"}
              />
            )}

            {entry.error_type && (
              <Metadata label="Error type" value={entry.error_type} />
            )}

            {entry.sandbox_image && (
              <Metadata label="Sandbox image" value={entry.sandbox_image} />
            )}
          </div>

          {entry.command && entry.command.length > 0 && (
            <CodeSection title="Execution command">
              {entry.command.join(" ")}
            </CodeSection>
          )}

          {entry.stdout && (
            <CodeSection title="Standard output" dark>
              {entry.stdout}
            </CodeSection>
          )}

          {entry.stderr && (
            <CodeSection title="Standard error" dark>
              {entry.stderr}
            </CodeSection>
          )}

          {entry.diff && (
            <CodeSection title="Execution diff" dark>
              {entry.diff}
            </CodeSection>
          )}

          {entry.source_sha256 && (
            <Metadata label="Source SHA-256" value={entry.source_sha256} />
          )}

          {entry.changed_files?.map((file) => (
            <div
              key={file.path}
              className="rounded-lg border border-[#EAE7E2] p-3"
            >
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#34312D]">
                <FileCode2 className="size-3.5" />
                {file.path}
              </p>

              <Metadata
                label="SHA-256 before"
                value={file.source_sha256_before}
              />

              <div className="mt-3">
                <Metadata
                  label="SHA-256 after"
                  value={file.source_sha256_after}
                />
              </div>
            </div>
          ))}

          {!hasDetails && (
            <p className="text-xs text-[#89847D]">
              No additional execution details were recorded for this step.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Metadata({ label, value }: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#89847D]">
        {label}
      </p>
      <p className="mt-1 break-all text-xs leading-relaxed text-[#34312D]">
        {value}
      </p>
    </div>
  );
}

function CodeSection({ title, children, dark = false }: {
  title: string;
  children: string;
  dark?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#89847D]">
        {title}
      </p>

      <pre
        className={`max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 font-mono text-[11px] leading-relaxed ${
          dark
            ? "border border-zinc-800 bg-zinc-950 text-zinc-100"
            : "border border-[#EAE7E2] bg-[#F8F7F5] text-[#34312D]"
        }`}
      >
        {children}
      </pre>
    </div>
  );
}

export default function EvidencePage() {
  const [repairs, setRepairs] = useState<RepairHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<RepairJobResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");

  const fetchRepairs = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);

      const items = await listRepairs(100, signal);

      if (signal?.aborted) return;

      setRepairs(items);

      setSelectedId((current) => {
        if (current && items.some((item) => item.job_id === current)) {
          return current;
        }

        return items[0]?.job_id ?? null;
      });
    } catch (err) {
      if (signal?.aborted) return;

      setError(
        err instanceof Error
          ? err.message
          : "Unable to retrieve repair records."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
        void fetchRepairs(controller.signal);
    });

    return () => controller.abort();
  }, [fetchRepairs]);

  useEffect(() => {
    if (!selectedId) {
      queueMicrotask(() => setSelectedJob(null));
      return;
    }

    const controller = new AbortController();

    async function fetchSelectedRepair() {
      setDetailLoading(true);
      setDetailError(null);
      setSelectedJob(null);

      try {
        const result = await getRepair(selectedId!, controller.signal);

        if (controller.signal.aborted) return;

        setSelectedJob(result);
      } catch (err) {
        if (controller.signal.aborted) return;

        setDetailError(
          err instanceof Error
            ? err.message
            : "Unable to retrieve this repair report."
        );
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    }

    void fetchSelectedRepair();

    return () => controller.abort();
  }, [selectedId]);

  const counts = useMemo(() => ({
    total: repairs.length,
    verified: repairs.filter(
      (item) =>
        item.state === "completed" &&
        item.report_status === "verified" &&
        item.report_integrity === "valid"
    ).length,
    unverified: repairs.filter(
      (item) =>
        item.state === "completed" &&
        item.report_status === "unverified"
    ).length,
    invalid: repairs.filter(
      (item) => item.report_integrity === "invalid"
    ).length,
  }), [repairs]);

  const filteredRepairs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return repairs.filter((item) => {
      if (!query) return true;

      return (
        item.job_id.toLowerCase().includes(query) ||
        getTitle(item).toLowerCase().includes(query) ||
        (item.error ?? "").toLowerCase().includes(query)
      );
    });
  }, [repairs, search]);

  const evidence = useMemo(() => {
    return selectedJob?.report?.evidence ?? [];
  }, [selectedJob]);

  const filteredEvidence = useMemo(() => {
    if (stageFilter === "all") return evidence;

    return evidence.filter((entry) => entry.step === stageFilter);
  }, [evidence, stageFilter]);

  const selectedItem = repairs.find(
    (item) => item.job_id === selectedId
    );

  async function handleRefresh() {
    setRefreshing(true);
    await fetchRepairs();
  }

  return (
    <AppShell
      title="Evidence explorer"
      description="Inspect execution records and verification evidence"
    >
      <div className="mx-auto w-full max-w-6xl space-y-7 pb-10 mt-6">
        {/* Page heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-mark text-[#0180fa]" />
              VERIFICATION RECORDS
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#292724]">
              Evidence explorer
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#89847D]">
              Inspect the execution records behind your repairs. Every
              result should be traceable to its original session.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-[#EAE7E2] bg-white px-3 text-xs font-semibold text-[#57534E] transition-colors hover:bg-[#FAF9F7] disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Compact archive summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EAE7E2] bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="text-xs font-semibold text-[#34312D]">
                    {counts.total} repair records
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500">
                    <CheckCircle2 className="size-3.5" />
                        {counts.verified} verified
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs text-yellow-500">
                    <AlertCircle className="size-3.5" />
                        {counts.unverified} unverified
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs text-red-500">
                    <ShieldAlert className="size-3.5" />
                        {counts.invalid} invalid
                </span>
            </div>

            <span className="text-[10px] text-[#89847D]">
                 Latest {repairs.length} records
            </span>
        </div>

        {/* Main explorer */}
        <section className="overflow-hidden rounded-2xl border border-[#EAE7E2] bg-white shadow-[0_4px_20px_rgba(35,30,20,0.025)]">
          <div className="grid min-h-[620px] lg:grid-cols-[310px_minmax(0,1fr)]">
            {/* Repair selector */}
            <aside className="border-b border-[#EAE7E2] bg-[#FAF9F7] lg:border-b-0 lg:border-r">
              <div className="border-b border-[#EAE7E2] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[#34312D]">
                    Repair records
                  </h2>

                  <span className="text-[10px] text-[#89847D]">
                    {filteredRepairs.length} records
                  </span>
                </div>

                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#A49D93]" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search repairs..."
                    aria-label="Search repair records"
                    className="h-9 w-full rounded-lg border border-[#EAE7E2] bg-white pl-9 pr-3 text-xs text-[#34312D] outline-none placeholder:text-[#A49D93] focus:border-[#C8BFF4]"
                  />
                </div>
              </div>

              <div className="max-h-[560px] space-y-1 overflow-y-auto p-2">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-xs text-[#89847D]">
                    <LoaderCircle className="size-4 animate-spin" />
                    Loading repair records...
                  </div>
                ) : error ? (
                  <div className="p-4 text-center">
                    <AlertCircle className="mx-auto size-5 text-red-500" />
                    <p className="mt-2 text-xs text-red-600">{error}</p>
                  </div>
                ) : filteredRepairs.length === 0 ? (
                  <p className="px-3 py-10 text-center text-xs text-[#89847D]">
                    No matching repair records.
                  </p>
                ) : (
                  filteredRepairs.map((item) => {
                    const status = getSessionStatus(item);
                    const StatusIcon = status.icon;
                    const selected = selectedId === item.job_id;

                    return (
                      <button
                        key={item.job_id}
                        type="button"
                        onClick={() => setSelectedId(item.job_id)}
                        aria-pressed={selected}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          selected
                            ? "border-[#0180fa]/70 bg-white shadow-sm"
                            : "border-transparent hover:bg-white"
                        }`}
                      >
                        <p className="line-clamp-2 text-xs font-semibold leading-relaxed text-[#34312D]">
                          {getTitle(item)}
                        </p>

                        <p className="mt-1.5 font-mono text-[10px] text-[#A19A90]">
                          {item.job_id.slice(0, 18)}...
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${status.className}`}>
                            <StatusIcon className={`size-2.5 ${item.state === "running" ? "animate-spin" : ""}`} />
                            {status.label}
                          </span>

                          <span className="text-[10px] text-[#A19A90]">
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Selected report */}
            <div className="min-w-0 p-4 sm:p-5 lg:p-6">
              {!selectedId ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <FileText className="size-8 text-[#B1AAA0]" />
                  <h3 className="mt-3 text-sm font-semibold text-[#34312D]">
                    No repair selected
                  </h3>
                  <p className="mt-1 text-xs text-[#89847D]">
                    Select a repair record to inspect its evidence.
                  </p>
                </div>
              ) : detailLoading ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-[#89847D]">
                  <LoaderCircle className="size-6 animate-spin text-[#7665D8]" />
                  <p className="text-xs">Retrieving execution evidence...</p>
                </div>
              ) : detailError ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <AlertCircle className="size-7 text-red-500" />
                  <h3 className="mt-3 text-sm font-semibold text-[#34312D]">
                    Unable to load evidence
                  </h3>
                  <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#89847D]">
                    {detailError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="mt-4 text-xs font-semibold text-[#7163C7] hover:underline"
                  >
                    Select another repair
                  </button>
                </div>
              ) : selectedJob ? (
                <div className="space-y-5">
                  {/* Selected session header */}
<div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAE7E2] pb-4">
  <div className="min-w-0">
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7665D8]">
      <Activity className="size-3.5" />
      Selected repair
    </div>

    <h2 className="mt-2 text-lg font-semibold text-[#292724]">
      {selectedItem ? getTitle(selectedItem) : "Repair session"}
    </h2>

    <p className="mt-1 break-all font-mono text-[10px] text-[#89847D]">
      {selectedJob.job_id}
    </p>
  </div>

  <Link
    href={`/repairs/${encodeURIComponent(selectedJob.job_id)}`}
    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#EAE7E2] bg-white px-3 py-2 text-[11px] font-semibold text-[#57534E] transition-colors hover:bg-[#FAF9F7]"
  >
    Open repair session
    <ArrowUpRight className="size-3.5" />
  </Link>
</div>

{/* Trust and verification status */}
<div className="flex flex-wrap items-center gap-2">
  <span className="rounded-full bg-[#F5F3F0] px-3 py-1.5 text-[10px] font-semibold text-[#57534E]">
    Integrity: {selectedItem?.report_integrity ?? "Unknown"}
  </span>

  {selectedJob.report && (
    <span
      className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${
        selectedJob.report.status === "verified"
          ? "bg-emerald-50 text-emerald-500"
          : "bg-amber-50 text-amber-500"
      }`}
    >
      {selectedJob.report.status === "verified"
        ? "Fix verified"
        : "Fix unverified"}
    </span>
  )}
</div>

{!selectedJob.report && (
  <div className="rounded-xl border border-dashed border-[#EAE7E2] p-5">
    <p className="text-sm font-semibold text-[#34312D]">
      Evidence is not available yet
    </p>
    <p className="mt-1 text-xs leading-relaxed text-[#89847D]">
      This session has not produced a readable report. Check its execution
      status or open the repair session for more information.
    </p>
  </div>
)}

                  {/* Stage filters */}
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-[#34312D]">
                        Execution evidence
                      </h3>
                      <span className="text-[10px] text-[#89847D]">
                        {filteredEvidence.length} of {evidence.length} records
                      </span>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      {STAGES.map((stage) => {
                        const active = stageFilter === stage.value;

                        return (
                          <button
                            key={stage.value}
                            type="button"
                            onClick={() => setStageFilter(stage.value)}
                            aria-pressed={active}
                            className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-colors ${
                              active
                                ? "bg-[#292724] text-white"
                                : "bg-[#F5F3F0] text-[#777168] hover:bg-[#ECE9E4]"
                            }`}
                          >
                            {stage.label}
                          </button>
                        );
                      })}
                    </div>

                    {evidence.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#EAE7E2] p-8 text-center">
                        <FileText className="mx-auto size-6 text-[#B1AAA0]" />
                        <p className="mt-2 text-xs font-medium text-[#57534E]">
                          No execution evidence available
                        </p>
                        <p className="mt-1 text-[11px] text-[#89847D]">
                          This report does not contain recorded evidence entries.
                        </p>
                      </div>
                    ) : filteredEvidence.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[#EAE7E2] p-6 text-center text-xs text-[#89847D]">
                        No records found for this execution stage.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredEvidence.map((entry, index) => (
                          <EvidenceRecord
                            key={`${entry.step}-${index}`}
                            entry={entry}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Report metadata */}
                  {selectedJob.report && (
                    <div className="rounded-xl bg-[#FAF9F7] p-4">
                      <h3 className="text-xs font-semibold text-[#34312D]">
                        Report information
                      </h3>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Metadata
                          label="Project"
                          value={selectedJob.report.project}
                        />
                        <Metadata
                          label="Report timestamp"
                          value={formatDate(selectedJob.report.timestamp_utc)}
                        />
                      </div>

                      <p className="mt-3 text-xs leading-relaxed text-[#777168]">
                        {selectedJob.report.summary}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <p className="text-[10px] leading-relaxed text-[#A19A90]">
          Archive metrics reflect the latest 100 repair records returned by
          the backend. Detailed execution evidence is retrieved only when
          a repair is selected.
        </p>
      </div>
    </AppShell>
  );
}
