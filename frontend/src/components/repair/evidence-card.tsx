
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { Badge } from "@/components/ui/badge";

import {
  CheckCircle2,
  Terminal,
} from "lucide-react";

import type { EvidenceEntry } from "@/types/repair";

const STAGE_LABELS: Record<string, string> = {
  baseline_tests: "Baseline tests",
  patch_generation: "Patch generation",
  patch_application: "Patch application",
  post_patch_tests: "Post-patch tests",
};

function formatStage(step: string): string {
  return STAGE_LABELS[step] ?? step.replaceAll("_", " ");
}

interface EvidenceCardProps {
  entry: EvidenceEntry;
  index: number;
}

export default function EvidenceCard({
  entry,
  index,
}: EvidenceCardProps) {
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
