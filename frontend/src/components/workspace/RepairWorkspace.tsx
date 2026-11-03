"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";

import {
  getRepair,
  submitRepair,
  submitRepositoryRepair,
} from "@/lib/api";

import type {
  EvidenceEntry,
  JobState,
  RepairJobResponse,
} from "@/types/repair";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  ArrowRight,
  FileArchive,
  FileCode2,
  Upload,
  CheckCircle2,
  Circle,
  CircleAlert,
  ShieldCheck,
  Terminal,
  Bug,
  FolderCode,
} from "lucide-react";

const POLL_INTERVAL = 2000;
const MAX_REPOSITORY_SIZE = 25 * 1024 * 1024;

type RepairMode = "demo" | "repository";

type RepairWorkspaceProps = {
  historyJobId: string | null;
  onHistorySelectionCleared: () => void;
};

const stages = [
  { id: "baseline_tests", label: "Baseline tests" },
  { id: "patch_generation", label: "Patch generation" },
  { id: "patch_application", label: "Patch application" },
  { id: "post_patch_tests", label: "Post-patch tests" },
];

function formatStage(step: string): string {
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

function ExecutionTimeline({ job }: { job: RepairJobResponse | null }) {
  const evidence = job?.report?.evidence ?? [];

  const completedStages = stages.filter((stage) =>
    evidence.some((entry) => entry.step === stage.id)
  ).length;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Execution Progress</CardTitle>
            <CardDescription>
              Verification pipeline stages and evidence checkpoints.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">
            Evidence recorded
          </span>
          <span className="font-medium tabular-nums">
            {completedStages}/{stages.length}
          </span>
        </div>

        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{
              width: `${(completedStages / stages.length) * 100}%`,
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {stages.map((stage) => {
            const recorded = evidence.some(
              (entry) => entry.step === stage.id
            );

            return (
              <div
                key={stage.id}
                className="flex min-h-11 items-center gap-2.5 rounded-md border border-border/70 bg-muted/20 px-3 py-2"
              >
                {recorded ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                )}

                <span className="text-xs font-medium">
                  {stage.label}
                </span>

                <span className="ml-auto text-[10px] text-muted-foreground">
                  {recorded ? "Recorded" : "Pending"}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceCard({
  entry,
  index,
}: {
  entry: EvidenceEntry;
  index: number;
}) {
  const successful = entry.exit_code === 0 && !entry.timed_out;

  return (
    <AccordionItem
      value={`${entry.step}-${index}`}
      className="border-b border-border/70 last:border-0"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
              successful
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {successful ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Terminal className="size-4" />
            )}
          </div>

          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-foreground">
              {formatStage(entry.step)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {entry.executor ?? "Execution evidence"}
            </p>
          </div>

          {entry.exit_code != null ? (
            <Badge
              variant={successful ? "outline" : "secondary"}
              className="mr-2 shrink-0 font-mono text-xs"
            >
              Exit {entry.exit_code}
            </Badge>
          ) : (
            <Badge variant="secondary" className="mr-2 shrink-0 text-xs">
              Evidence recorded
            </Badge>
          )}
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4">
        <div className="space-y-4 pb-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {entry.execution_id && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Execution ID
                </p>
                <code className="break-all text-xs text-foreground">
                  {entry.execution_id}
                </code>
              </div>
            )}

            {entry.executor && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Executor
                </p>
                <p className="text-sm text-foreground">
                  {entry.executor}
                </p>
              </div>
            )}

            {entry.exit_code !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Exit code
                </p>
                <p className="text-sm font-medium text-foreground">
                  {entry.exit_code ?? "Not available"}
                </p>
              </div>
            )}

            {entry.timed_out !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Timed out
                </p>
                <p className="text-sm text-foreground">
                  {entry.timed_out ? "Yes" : "No"}
                </p>
              </div>
            )}
          </div>

          {entry.command && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Execution command
              </p>
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/60 p-3 font-mono text-xs text-foreground">
                {entry.command.join(" ")}
              </pre>
            </div>
          )}

          {entry.stdout && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Standard output
              </p>
              <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100">
                {entry.stdout}
              </pre>
            </div>
          )}

          {entry.stderr && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Standard error
              </p>
              <pre className="max-h-64 overflow-auto rounded-lg border border-red-500/20 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-red-300">
                {entry.stderr}
              </pre>
            </div>
          )}

          {entry.diff && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Execution diff
              </p>
              <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100">
                {entry.diff}
              </pre>
            </div>
          )}

          {entry.source_sha256 && (
            <div>
              <p className="text-xs text-muted-foreground">
                Source SHA-256
              </p>
              <code className="break-all text-xs text-foreground">
                {entry.source_sha256}
              </code>
            </div>
          )}

          {entry.changed_files?.map((file) => (
            <div
              key={file.path}
              className="rounded-lg border border-border p-3"
            >
              <p className="mb-2 text-xs font-medium text-foreground">
                {file.path}
              </p>
              <p className="text-xs text-muted-foreground">
                SHA-256 before
              </p>
              <code className="break-all text-xs text-foreground">
                {file.source_sha256_before}
              </code>
              <p className="mt-2 text-xs text-muted-foreground">
                SHA-256 after
              </p>
              <code className="break-all text-xs text-foreground">
                {file.source_sha256_after}
              </code>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function RepairResult({ job }: { job: RepairJobResponse }) {
  const report = job.report;

  if (job.state === "failed") {
    return (
      <Card className="mt-5 border-red-500/30">
        <CardContent className="flex gap-3 p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Repair job failed
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {job.error ?? "The repair could not be completed."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (job.state !== "completed" || !report) {
    return null;
  }

  const verified = report.status === "verified";
  const scope = report.verification_scope;
  const changedFiles = report.changed_files ?? [];
  const evidence = report.evidence ?? [];

  return (
    <div className="mt-5 space-y-3">
      {/* Verification summary */}
      <Card
        className={
          verified
            ? "border-emerald-500/30 bg-emerald-500/[0.025]"
            : "border-amber-500/30 bg-amber-500/[0.025]"
        }
      >
        <CardContent className="flex items-start gap-3 p-4">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              verified
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            {verified ? (
              <ShieldCheck className="size-5" />
            ) : (
              <CircleAlert className="size-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {verified ? "Fix verified" : "Fix unverified"}
              </h3>

              <Badge variant={verified ? "outline" : "secondary"}>
                {report.status}
              </Badge>
            </div>

            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {report.summary}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Repair analysis */}
      {(report.root_cause || report.patch_summary) && (
        <Card>
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="text-sm">
              Repair analysis
            </CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
            {report.root_cause && (
              <div className="min-w-0">
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  Root cause
                </p>
                <p className="text-sm leading-relaxed text-foreground">
                  {report.root_cause}
                </p>
              </div>
            )}

            {report.patch_summary && (
              <div className="min-w-0 sm:border-l sm:border-border sm:pl-4">
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  Patch overview
                </p>
                <p className="text-sm leading-relaxed text-foreground">
                  {report.patch_summary}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Changed files */}
      {changedFiles.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 pb-3 pt-4">
            <div>
              <CardTitle className="text-sm">
                Changed files
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Files modified during the repair
              </CardDescription>
            </div>

            <Badge variant="secondary">
              {changedFiles.length} modified
            </Badge>
          </CardHeader>

          <CardContent className="space-y-2 px-4 pb-4 pt-0">
            {changedFiles.map((file) => (
              <div
                key={file.path}
                className="rounded-md border border-border bg-muted/20 p-3"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <FileCode2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

                  <code className="min-w-0 break-all text-xs font-medium text-foreground">
                    {file.path}
                  </code>
                </div>

                <Accordion className="mt-1">
                  <AccordionItem value="hashes" className="border-b-0">
                    <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
                      View integrity hashes
                    </AccordionTrigger>

                    <AccordionContent>
                      <div className="grid gap-3 pt-1">
                        <div className="min-w-0">
                          <p className="mb-1 text-xs text-muted-foreground">
                            SHA-256 before
                          </p>
                          <code className="block break-all font-mono text-xs text-foreground">
                            {file.source_sha256_before}
                          </code>
                        </div>

                        <div className="min-w-0">
                          <p className="mb-1 text-xs text-muted-foreground">
                            SHA-256 after
                          </p>
                          <code className="block break-all font-mono text-xs text-foreground">
                            {file.source_sha256_after}
                          </code>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Source diff */}
      {report.diff && (
        <Card>
          <CardHeader className="px-4 pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileCode2 className="size-4 text-muted-foreground" />
              Source diff
            </CardTitle>
            <CardDescription className="text-xs">
              Actual patch applied to the source code
            </CardDescription>
          </CardHeader>

          <CardContent className="px-4 pb-4 pt-0">
            <pre className="max-h-[360px] overflow-auto rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100">
              {report.diff}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Execution evidence */}
      <Card>
        <CardHeader className="px-4 pb-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Terminal className="size-4 text-muted-foreground" />
              Execution evidence
            </CardTitle>

            <Badge variant="secondary">
              {evidence.length} recorded steps
            </Badge>
          </div>

          <CardDescription className="text-xs">
            Inspect test results, execution logs, integrity data, and other recorded evidence.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-0">
          {evidence.length > 0 ? (
            <Accordion className="w-full">
              {evidence.map((entry, index) => (
                <EvidenceCard
                  key={`${entry.step}-${index}`}
                  entry={entry}
                  index={index}
                />
              ))}
            </Accordion>
          ) : (
            <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              No execution evidence was recorded in this report.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Verification scope and additional information */}
      {(scope || report.error) && (
        <Card>
          <CardContent className="space-y-4 p-4">
            {scope && (
              <div>
                <h3 className="text-xs font-semibold text-foreground">
                  Verification scope
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {Array.isArray(scope) ? scope.join(" ") : scope}
                </p>
              </div>
            )}

            {scope && report.error && (
              <div className="border-t border-border" />
            )}

            {report.error && (
              <div>
                <h3 className="text-xs font-semibold text-foreground">
                  Additional information
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {report.error}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function RepairWorkspace({
  historyJobId,
  onHistorySelectionCleared,
}: RepairWorkspaceProps) {
  const [mode, setMode] = useState<RepairMode>("demo");

  const [bugReport, setBugReport] = useState("");
  const [expectedFailure, setExpectedFailure] = useState("");
  const [repositoryFile, setRepositoryFile] = useState<File | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<RepairJobResponse | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const active =
    jobId !== null &&
    (job === null ||
      job.state === "queued" ||
      job.state === "running");

  // Load a selected repair from history.
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

  // Poll the backend while a repair is queued or running.
  useEffect(() => {
    if (!active || !jobId) return;

    const pollingJobId = jobId;
    const controller = new AbortController();

    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const updatedJob = await getRepair(
          pollingJobId,
          controller.signal
        );

        if (controller.signal.aborted) return;

        setJob(updatedJob);
        setError(null);

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

        // Keep polling after transient network failures.
        timeout = setTimeout(poll, POLL_INTERVAL);
      }
    }

    void poll();

    return () => {
      controller.abort();

      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [jobId, active]);

  const handleModeChange = useCallback(
    (nextMode: RepairMode) => {
      if (active || submitting || mode === nextMode) return;

      setMode(nextMode);
      setError(null);

      setRepositoryFile(null);
      setExpectedFailure("");
      setBugReport("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [active, submitting, mode]
  );

  function handleRepositoryChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] ?? null;

    setError(null);

    if (!file) {
      setRepositoryFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setRepositoryFile(null);
      setError("Please select a ZIP archive.");
      event.target.value = "";
      return;
    }

    if (file.size === 0) {
      setRepositoryFile(null);
      setError("The selected ZIP archive is empty.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_REPOSITORY_SIZE) {
      setRepositoryFile(null);
      setError("The ZIP archive must be 25 MB or smaller.");
      event.target.value = "";
      return;
    }

    setRepositoryFile(file);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting || active) return;

    const description = bugReport.trim();
    const failure = expectedFailure.trim();

    if (description.length < 10 || description.length > 4000) {
      setError(
        "Bug description must be between 10 and 4,000 characters."
      );
      return;
    }

    if (mode === "repository") {
      if (!repositoryFile) {
        setError("Please select a repository ZIP file.");
        return;
      }

      if (!repositoryFile.name.toLowerCase().endsWith(".zip")) {
        setError("Please select a valid ZIP archive.");
        return;
      }

      if (
        repositoryFile.size === 0 ||
        repositoryFile.size > MAX_REPOSITORY_SIZE
      ) {
        setError(
          "The repository ZIP must be greater than 0 bytes and no larger than 25 MB."
        );
        return;
      }

      if (failure.length < 1 || failure.length > 300) {
        setError(
          "Expected failure marker must be between 1 and 300 characters."
        );
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    onHistorySelectionCleared();

    setJob(null);
    setJobId(null);

    try {
      const response =
        mode === "repository"
          ? await submitRepositoryRepair(
              repositoryFile!,
              description,
              failure
            )
          : await submitRepair(description);

      setJobId(response.job_id);

      setBugReport("");
      setExpectedFailure("");
      setRepositoryFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
      {/* Workflow introduction */}
      <div className="mb-5 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Get started
        </p>
        <h2 className="text-lg font-semibold tracking-tight">
          Choose how you want to repair
        </h2>
        <p className="text-sm text-muted-foreground">
          Start with a bug description or investigate an entire Python repository.
        </p>
      </div>

      {/* Workflow shortcuts */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleModeChange("demo")}
          disabled={submitting || active}
          className={`group rounded-xl border p-4 text-left transition-all ${
            mode === "demo"
              ? "border-primary/40 bg-primary/[0.035] shadow-sm"
              : "border-border bg-background hover:border-foreground/20 hover:bg-muted/30"
          } disabled:pointer-events-none disabled:opacity-50`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <Bug className="size-5 text-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">
              {mode === "demo" ? "Selected" : "01"}
            </span>
          </div>

          <h3 className="text-sm font-semibold">Investigate a bug</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Describe a failure, reproduce the issue, and generate a verified fix.
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleModeChange("repository")}
          disabled={submitting || active}
          className={`group rounded-xl border p-4 text-left transition-all ${
            mode === "repository"
              ? "border-primary/40 bg-primary/[0.035] shadow-sm"
              : "border-border bg-background hover:border-foreground/20 hover:bg-muted/30"
          } disabled:pointer-events-none disabled:opacity-50`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <FolderCode className="size-5 text-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">
              {mode === "repository" ? "Selected" : "02"}
            </span>
          </div>

          <h3 className="text-sm font-semibold">Repair a repository</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Upload a Python project and let ProofLoop investigate its failing tests.
          </p>
        </button>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">New repair</CardTitle>
              <CardDescription>
                Choose a repair method and describe the issue you want ProofLoop to investigate.
              </CardDescription>
            </div>
            <div className="hidden size-10 items-center justify-center rounded-lg bg-muted sm:flex">
              <FileCode2 className="size-5" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
  <Label>Repair method</Label>

  <Tabs
    value={mode}
    onValueChange={(val) => handleModeChange(val as RepairMode)}
    className="w-full"
  >
    <TabsList className="grid h-10 w-full grid-cols-2 sm:w-[360px]">
      <TabsTrigger
        value="demo"
        disabled={submitting || active}
      >
        Demo repair
      </TabsTrigger>

      <TabsTrigger
        value="repository"
        disabled={submitting || active}
      >
        <Upload className="mr-1.5 size-3.5" />
        Upload repository
      </TabsTrigger>
    </TabsList>
  </Tabs>
</div>

            {mode === "repository" && (
              <div className="space-y-2">
                <Label htmlFor="repository-zip">Python repository</Label>

                <div className="rounded-xl border border-dashed bg-muted/20 p-5">
                  <input
                    ref={fileInputRef}
                    id="repository-zip"
                    type="file"
                    accept=".zip,application/zip"
                    onChange={handleRepositoryChange}
                    disabled={submitting || active}
                    className="sr-only"
                  />

                  <label
                    htmlFor="repository-zip"
                    className="flex cursor-pointer flex-col items-center justify-center gap-3 text-center"
                  >
                    <div className="flex size-11 items-center justify-center rounded-xl border bg-background">
                      <FileArchive className="size-5" />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        Click to upload your repository
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ZIP archive · Maximum file size 25 MB
                      </p>
                    </div>
                  </label>

                  {repositoryFile && (
                    <div className="mt-4 flex items-center gap-3 rounded-lg border bg-background p-3">
                      <FileArchive className="size-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {repositoryFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(repositoryFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Include your Python source files and pytest tests.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="bug-report">Describe the bug</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {bugReport.length.toLocaleString()} / 4,000
                </span>
              </div>

              <Textarea
                id="bug-report"
                value={bugReport}
                onChange={(event) => setBugReport(event.target.value)}
                placeholder={`Describe the bug, what you expected to happen, and what actually happened...

Example: calculate_discount returns the original price when discount_percent is 100. A full discount should return zero.`}
                minLength={10}
                maxLength={4000}
                required
                disabled={submitting || active}
                className="min-h-36 resize-y"
              />

              <p className="text-xs text-muted-foreground">
                Be specific about the expected behavior and the observed failure.
              </p>
            </div>

            {mode === "repository" && (
              <div className="space-y-2">
                <Label htmlFor="expected-failure">
                  Expected failure marker
                </Label>

                <Input
                  id="expected-failure"
                  type="text"
                  value={expectedFailure}
                  onChange={(event) => setExpectedFailure(event.target.value)}
                  placeholder="e.g. AssertionError: expected 0, got 100"
                  maxLength={300}
                  required
                  disabled={submitting || active}
                />

                <p className="text-xs text-muted-foreground">
                  A distinctive message that should appear in the failing baseline test output.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-500" />
                {mode === "demo" ? "Demo fixture" : "Python repository"}
                <span>·</span>
                Evidence-backed verification
              </div>

              <button
                type="submit"
                disabled={
                  submitting ||
                  active ||
                  bugReport.trim().length < 10 ||
                  (mode === "repository" &&
                    (!repositoryFile || expectedFailure.trim().length === 0))
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Start repair"}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

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
              <span className="result-eyebrow">
                REPAIR EXECUTION
              </span>

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

          <div className="mt-5">
            <ExecutionTimeline job={job} />
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