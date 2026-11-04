import {
  AlertCircle,
  CheckCircle2,
  Settings2,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react";

import { Accordion } from "@/components/ui/accordion";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
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
      <Card className="border-red-500/25">
        <CardContent className="flex items-start gap-3 p-5">
          <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Repair execution failed
            </h3>

            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {job.error ?? "The repair could not be completed."}
            </p>

            <p className="mt-2 text-xs text-muted-foreground">
              This execution did not produce a completed repair result.
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
  const evidence = report.evidence ?? [];

  const baseline = [...evidence]
    .reverse()
    .find((entry) => entry.step === "baseline_tests");

  const postPatch = [...evidence]
    .reverse()
    .find((entry) => entry.step === "post_patch_tests");

  const baselineReproduced =
    baseline?.failure_reproduced === true;

  const regressionPassed =
    postPatch?.tests_passed ??
    (postPatch?.exit_code === 0 ? true : undefined);

  const hasAnalysis =
    Boolean(report.root_cause) ||
    Boolean(report.patch_summary) ||
    Boolean(report.verification_scope) ||
    Boolean(report.error);

  return (
    <div className="space-y-4">
      {/* Primary verification outcome */}
      <Card
        className={`overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white py-0 shadow-sm ring-0 ${
          verified
            ? "bg-white"
            : "bg-amber-500/[0.035]"
        }`}
      >
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                verified
                  ? "bg-green-500/10 text-green-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {verified ? (
                <ShieldCheck className="size-6" />
              ) : (
                <AlertCircle className="size-6" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {verified ? "Fix verified" : "Fix unverified"}
                </h2>

                <Badge variant={verified ? "outline" : "secondary"}>
                  {report.status}
                </Badge>
              </div>

              <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                {report.summary}
              </p>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                    baselineReproduced
                      ? "text-emerald-700"
                      : "text-muted-foreground"
                  }`}
                >
                  {baselineReproduced ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <AlertCircle className="size-3.5" />
                  )}
                  Baseline{" "}
                  {baselineReproduced ? "reproduced" : "not confirmed"}
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                    regressionPassed === true
                      ? "text-emerald-700"
                      : "text-muted-foreground"
                  }`}
                >
                  {regressionPassed === true ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <AlertCircle className="size-3.5" />
                  )}
                  Regression{" "}
                  {regressionPassed === true
                    ? "tests passed"
                    : regressionPassed === false
                      ? "tests failed"
                      : "outcome not confirmed"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actual source changes */}
      <FileDiffViewer report={report} />

      {/* Execution evidence */}
      <Card className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white py-0 shadow-sm ring-0">
        <CardHeader className="px-4 pb-3 pt-5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Terminal className="size-4 text-muted-foreground" />
              Execution evidence
            </CardTitle>

            <Badge variant="secondary">
              {evidence.length} {evidence.length === 1 ? "step" : "steps"}
            </Badge>
          </div>

          <CardDescription className="text-xs">
            Inspect the actual execution records supporting this repair.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-0 sm:px-5">
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
            <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              No execution evidence was recorded in this report.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Additional repair details */}
      {hasAnalysis && (
      <Card className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white py-0 shadow-sm ring-0">          
        <Accordion className="w-full">
            <AccordionItem value="repair-details" className="border-b-0">
              <AccordionTrigger className="px-5 py-5 hover:no-underline sm:px-6">
                <div className="flex min-w-0 items-center gap-3 text-left">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Settings2 className="size-4" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Repair analysis and verification details
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Root cause, patch explanation, and test scope
                    </p>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                <div className="space-y-4 border-t border-[#E5E7EB] px-5 py-5 sm:px-6">
                  {report.root_cause && (
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">
                        Root cause
                      </h3>

                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {report.root_cause}
                      </p>
                    </div>
                  )}

                  {report.patch_summary && (
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">
                        Patch explanation
                      </h3>

                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {report.patch_summary}
                      </p>
                    </div>
                  )}

                  {report.verification_scope && (
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">
                        Verification scope
                      </h3>

                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {Array.isArray(report.verification_scope)
                          ? report.verification_scope.join(" ")
                          : report.verification_scope}
                      </p>
                    </div>
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
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}
    </div>
  );
}
