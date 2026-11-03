
import {
  AlertCircle,
  ShieldCheck,
  Terminal,
} from "lucide-react";

import {
  Accordion,
} from "@/components/ui/accordion";

import { Badge } from "@/components/ui/badge";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import EvidenceCard from "@/components/repair/evidence-card";
import FileDiffViewer from "@/components/repair/file-diff-viewer";

import type { RepairJobResponse } from "@/types/repair";

interface RepairResultsProps {
  job: RepairJobResponse;
}

export default function RepairResults({ job }: RepairResultsProps) {
  const report = job.report;

  if (job.state === "failed") {
    return (
      <Card className="mt-5 border-red-500/30">
        <CardContent className="flex gap-3 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-500" />

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
              <AlertCircle className="size-5" />
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

      {/* Changed files and source diff */}
      <FileDiffViewer report={report} />

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
