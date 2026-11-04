import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock3,
  LoaderCircle,
  MinusCircle,
} from "lucide-react";

import type {
  EvidenceEntry,
  RepairJobResponse,
} from "@/types/repair";

const STAGES = [
  { id: "baseline_tests", label: "Baseline tests", description: "Reproduce the reported failure" },
  { id: "patch_generation", label: "Patch generation", description: "Generate a proposed fix" },
  { id: "patch_application", label: "Patch application", description: "Apply the source changes" },
  { id: "post_patch_tests", label: "Regression tests", description: "Evaluate the patched code" },
] as const;

type StageStatus = "success" | "failure" | "pending" | "neutral";

function getStageStatus(
  stageId: string,
  entries: EvidenceEntry[]
): StageStatus {
  const entry = [...entries].reverse().find(
    (item) => item.step === stageId
  );

  if (!entry) return "pending";

  if (entry.timed_out || entry.error_type) return "failure";

  if (stageId === "baseline_tests") {
    if (entry.failure_reproduced === true) return "success";
    if (entry.failure_reproduced === false) return "failure";
    return "neutral";
  }

  if (stageId === "post_patch_tests") {
    const passed =
      entry.tests_passed ??
      (entry.exit_code === 0 ? true : undefined);

    if (passed === true) return "success";
    if (passed === false) return "failure";
    return "neutral";
  }

  if (entry.success === true) return "success";
  if (entry.success === false) return "failure";

  if (entry.exit_code === 0) return "success";

  return "neutral";
}

const STATUS_CONFIG = {
  success: {
    label: "Confirmed",
    icon: CheckCircle2,
    className: "text-emerald-600 bg-emerald-500/10",
  },
  failure: {
    label: "Failed",
    icon: AlertCircle,
    className: "text-red-600 bg-red-500/10",
  },
  pending: {
    label: "Pending",
    icon: Circle,
    className: "text-muted-foreground bg-muted",
  },
  neutral: {
    label: "Recorded",
    icon: MinusCircle,
    className: "text-muted-foreground bg-muted",
  },
};

interface ExecutionTimelineProps {
  job: RepairJobResponse | null;
}

export default function ExecutionTimeline({
  job,
}: ExecutionTimelineProps) {
  const evidence = job?.report?.evidence ?? [];

  const completedStages = STAGES.filter((stage) => {
    const status = getStageStatus(stage.id, evidence);
    return status === "success" || status === "failure" || status === "neutral";
  }).length;

  const progress = (completedStages / STAGES.length) * 100;

  const active = job?.state === "queued" || job?.state === "running";

  const terminal = job?.state === "completed" || job?.state === "failed";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Repair pipeline
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Execution stages and evidence checkpoints
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {completedStages}/{STAGES.length}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Stages recorded
          </p>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {STAGES.map((stage, index) => {
          const status = getStageStatus(stage.id, evidence);
          const config = STATUS_CONFIG[status];
          const StatusIcon = config.icon;

          const isCurrent =
            active &&
            status === "pending" &&
            STAGES.slice(0, index).every(
              (previous) =>
                getStageStatus(previous.id, evidence) !== "pending"
            );

          return (
            <div
              key={stage.id}
              className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 transition-colors ${
                isCurrent
                  ? "border-primary/30 bg-primary/[0.035]"
                  : "border-border/70 bg-muted/10"
              }`}
            >
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${config.className}`}
              >
                {isCurrent ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <StatusIcon className="size-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-foreground">
                    {stage.label}
                  </p>

                  <span className="text-[10px] text-muted-foreground">
                    {isCurrent ? "In progress" : config.label}
                  </span>
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {stage.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {job?.state === "queued" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" />
          Waiting for a repair worker to start execution.
        </p>
      )}

      {job?.state === "failed" && (
        <p className="text-xs text-red-600">
          The repair job terminated before completing the workflow.
        </p>
      )}

      {terminal && job.state === "completed" && (
        <p className="text-xs text-muted-foreground">
          Execution has finished. Review the final report and evidence above.
        </p>
      )}
    </div>
  );
}
