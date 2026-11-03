
import {
  CheckCircle2,
  Circle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { RepairJobResponse } from "@/types/repair";

const STAGES = [
  { id: "baseline_tests", label: "Baseline tests" },
  { id: "patch_generation", label: "Patch generation" },
  { id: "patch_application", label: "Patch application" },
  { id: "post_patch_tests", label: "Post-patch tests" },
] as const;

interface ExecutionTimelineProps {
  job: RepairJobResponse | null;
}

export default function ExecutionTimeline({
  job,
}: ExecutionTimelineProps) {
  const evidence = job?.report?.evidence ?? [];

  const completedStages = STAGES.filter((stage) =>
    evidence.some((entry) => entry.step === stage.id)
  ).length;

  const progress = (completedStages / STAGES.length) * 100;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b px-5 py-4">
        <div className="space-y-1">
          <CardTitle className="text-base">
            Execution Progress
          </CardTitle>

          <CardDescription>
            Verification pipeline stages and evidence checkpoints.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">
            Evidence recorded
          </span>

          <span className="font-medium tabular-nums">
            {completedStages}/{STAGES.length}
          </span>
        </div>

        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STAGES.map((stage) => {
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
