import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Terminal,
} from "lucide-react";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { Badge } from "@/components/ui/badge";

import type { EvidenceEntry } from "@/types/repair";

const STAGE_LABELS: Record<string, string> = {
  baseline_tests: "Baseline tests",
  patch_generation: "Patch generation",
  patch_application: "Patch application",
  post_patch_tests: "Post-patch tests",
};

type EvidenceStatus = "success" | "failure" | "warning" | "neutral";

function formatStage(step: string): string {
  return (
    STAGE_LABELS[step] ??
    step.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function getEvidenceStatus(entry: EvidenceEntry): {
  status: EvidenceStatus;
  label: string;
  detail: string;
} {
  if (entry.timed_out) {
    return {
      status: "failure",
      label: "Timed out",
      detail: "Execution exceeded its time limit.",
    };
  }

  if (entry.error_type) {
    return {
      status: "failure",
      label: "Execution error",
      detail: entry.error_type,
    };
  }

  if (entry.step === "baseline_tests") {
    if (entry.failure_reproduced === true) {
      return {
        status: "success",
        label: "Failure reproduced",
        detail: "The expected baseline failure was reproduced.",
      };
    }

    if (entry.failure_reproduced === false) {
      return {
        status: "warning",
        label: "Not reproduced",
        detail: "The expected baseline failure was not reproduced.",
      };
    }

    return {
      status: "neutral",
      label: "Baseline recorded",
      detail: "Inspect the execution output to evaluate this baseline run.",
    };
  }

  if (entry.step === "post_patch_tests") {
    const passed =
      entry.tests_passed ??
      (entry.exit_code === 0 ? true : undefined);

    if (passed === true) {
      return {
        status: "success",
        label: "Tests passed",
        detail: "The post-patch test execution passed.",
      };
    }

    if (passed === false) {
      return {
        status: "failure",
        label: "Tests failed",
        detail: "The post-patch test execution did not pass.",
      };
    }
  }

  if (entry.success === true) {
    return {
      status: "success",
      label: "Successful",
      detail: "This execution step completed successfully.",
    };
  }

  if (entry.success === false) {
    return {
      status: "failure",
      label: "Unsuccessful",
      detail: "This execution step did not complete successfully.",
    };
  }

  if (entry.exit_code === 0) {
    return {
      status: "success",
      label: "Completed",
      detail: "The execution process exited successfully.",
    };
  }

  if (entry.exit_code != null) {
    return {
      status: "neutral",
      label: `Exit code ${entry.exit_code}`,
      detail: "Inspect the execution output for the result.",
    };
  }

  return {
    status: "neutral",
    label: "Evidence recorded",
    detail: "No explicit execution outcome was provided.",
  };
}

const STATUS_STYLES: Record<
  EvidenceStatus,
  { icon: typeof CheckCircle2; container: string; badge: "outline" | "secondary" | "destructive" }
> = {
  success: {
    icon: CheckCircle2,
    container: "bg-emerald-500/10 text-emerald-600",
    badge: "outline",
  },
  failure: {
    icon: AlertCircle,
    container: "bg-red-500/10 text-red-600",
    badge: "destructive",
  },
  warning: {
    icon: AlertCircle,
    container: "bg-amber-500/10 text-amber-600",
    badge: "secondary",
  },
  neutral: {
    icon: CircleHelp,
    container: "bg-muted text-muted-foreground",
    badge: "secondary",
  },
};

interface EvidenceCardProps {
  entry: EvidenceEntry;
  index: number;
}

export default function EvidenceCard({
  entry,
  index,
}: EvidenceCardProps) {
  const result = getEvidenceStatus(entry);
  const styles = STATUS_STYLES[result.status];
  const StatusIcon = styles.icon;

  return (
    <AccordionItem
      value={`${entry.step}-${index}`}
      className="border-b border-border/70 last:border-0"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${styles.container}`}
          >
            <StatusIcon className="size-4" />
          </div>

          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-foreground">
              {formatStage(entry.step)}
            </p>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {entry.executor ?? result.detail}
            </p>
          </div>

          <Badge
            variant={styles.badge}
            className="mr-2 shrink-0 text-[10px]"
          >
            {result.label}
          </Badge>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4">
        <div className="space-y-4 pb-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {result.detail}
          </p>

          {entry.expected_failure && (
            <div>
              <p className="text-xs text-muted-foreground">
                Expected failure
              </p>
              <p className="mt-1 text-sm text-foreground">
                {entry.expected_failure}
              </p>
            </div>
          )}

          {entry.failure_reproduced !== undefined &&
            entry.failure_reproduced !== null && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Failure reproduced
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {entry.failure_reproduced ? "Yes" : "No"}
                </p>
              </div>
            )}

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

            {entry.execution_started !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Execution started
                </p>
                <p className="text-sm text-foreground">
                  {entry.execution_started ? "Yes" : "No"}
                </p>
              </div>
            )}

            {entry.sandbox_image && (
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  Sandbox image
                </p>
                <code className="break-all text-xs text-foreground">
                  {entry.sandbox_image}
                </code>
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

          {entry.edits && entry.edits.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Proposed edits
              </p>

              {entry.edits.map((edit, editIndex) => (
                <div
                  key={`${edit.path}-${editIndex}`}
                  className="space-y-2 rounded-lg border border-border p-3"
                >
                  <code className="break-all text-xs font-medium text-foreground">
                    {edit.path}
                  </code>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {edit.explanation}
                  </p>

                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      Original
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-red-500/5 p-2 font-mono text-xs text-foreground">
                      {edit.old_text}
                    </pre>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      Proposed
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-emerald-500/5 p-2 font-mono text-xs text-foreground">
                      {edit.new_text}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}

          {entry.source_path && (
            <div>
              <p className="text-xs text-muted-foreground">
                Source path
              </p>
              <code className="break-all text-xs text-foreground">
                {entry.source_path}
              </code>
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

          {(entry.source_sha256_before || entry.source_sha256_after) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {entry.source_sha256_before && (
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    SHA-256 before
                  </p>
                  <code className="break-all text-xs text-foreground">
                    {entry.source_sha256_before}
                  </code>
                </div>
              )}

              {entry.source_sha256_after && (
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    SHA-256 after
                  </p>
                  <code className="break-all text-xs text-foreground">
                    {entry.source_sha256_after}
                  </code>
                </div>
              )}
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

          {entry.error_type && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-xs font-semibold text-red-600">
                Execution error
              </p>
              <p className="mt-1 text-xs text-foreground">
                {entry.error_type}
              </p>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}