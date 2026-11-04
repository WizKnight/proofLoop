"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileCode2,
  Files,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";

import {
  Accordion,
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

import type { RepairJobResponse } from "@/types/repair";

type RepairReport = NonNullable<RepairJobResponse["report"]>;

interface FileDiffViewerProps {
  report: RepairReport;
}

function getDiffStats(diff: string) {
  const lines = diff.split("\n");

  return {
    additions: lines.filter(
      (line) => line.startsWith("+") && !line.startsWith("+++")
    ).length,
    deletions: lines.filter(
      (line) => line.startsWith("-") && !line.startsWith("---")
    ).length,
  };
}

function DiffLine({ line }: { line: string }) {
  let style = "text-zinc-300";
  let marker = " ";

  if (line.startsWith("+++") || line.startsWith("---")) {
    style = "text-zinc-400 font-semibold";
  } else if (line.startsWith("@@")) {
    style = "text-sky-300";
  } else if (line.startsWith("+")) {
    style = "bg-green-500/10 text-green-400";
    marker = "+";
  } else if (line.startsWith("-")) {
    style = "bg-red-500/10 text-red-400";
    marker = "-";
  }

  return (
    <div className={`flex min-w-max ${style}`}>
      <span className="sticky left-0 w-7 shrink-0 select-none bg-zinc-950/90 px-2 text-right text-zinc-500">
        {marker}
      </span>

      <span className="whitespace-pre px-2">
        {line.startsWith("+") || line.startsWith("-")
          ? line.slice(1)
          : line}
      </span>
    </div>
  );
}

export default function FileDiffViewer({
  report,
}: FileDiffViewerProps) {
  const [expanded, setExpanded] = useState(false);

  const changedFiles = report.changed_files ?? [];
  const diff = report.diff;

  const stats = useMemo(
    () => (diff ? getDiffStats(diff) : { additions: 0, deletions: 0 }),
    [diff]
  );

  const diffLines = diff?.split("\n") ?? [];
  const visibleLines = expanded
    ? diffLines
    : diffLines.slice(0, 80);

  const hasMoreLines = diffLines.length > 80;

  if (changedFiles.length === 0 && !diff) {
    return null;
  }

  return (
    <div className="space-y-3">
      {changedFiles.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 pb-3 pt-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Files className="size-4 text-muted-foreground" />
                Changed files
              </CardTitle>

              <CardDescription className="mt-1 text-xs">
                Source files modified during this repair
              </CardDescription>
            </div>

            <Badge variant="secondary">
              {changedFiles.length} {changedFiles.length === 1 ? "file" : "files"}
            </Badge>
          </CardHeader>

          <CardContent className="space-y-2 px-4 pb-4 pt-0">
            {changedFiles.map((file) => (
              <div
                key={file.path}
                className="rounded-xl border border-border bg-muted/10 p-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileCode2 className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <code className="block break-all text-xs font-medium text-foreground">
                      {file.path}
                    </code>

                    <div className="mt-1.5 flex items-center gap-2">
                      <ShieldCheck className="size-3 text-emerald-600" />
                      <span className="text-[10px] text-muted-foreground">
                        Source integrity hashes recorded
                      </span>
                    </div>
                  </div>
                </div>

                <Accordion className="mt-2">
                  <AccordionItem
                    value={`hashes-${file.path}`}
                    className="border-b-0"
                  >
                    <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
                      Inspect SHA-256 hashes
                    </AccordionTrigger>

                    <AccordionContent>
                      <div className="grid gap-3 pt-2 sm:grid-cols-2">
                        <div className="min-w-0">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Before patch
                          </p>

                          <code className="block break-all rounded-md bg-muted/60 p-2 font-mono text-[11px] text-foreground">
                            {file.source_sha256_before}
                          </code>
                        </div>

                        <div className="min-w-0">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            After patch
                          </p>

                          <code className="block break-all rounded-md bg-muted/60 p-2 font-mono text-[11px] text-foreground">
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

      {diff && (
        <Card className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white py-0 shadow-sm ring-0">
          <CardHeader className="px-4 pb-3 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileCode2 className="size-4 text-muted-foreground" />
                  Source diff
                </CardTitle>

                <CardDescription className="mt-1 text-xs">
                  Actual patch recorded by the repair workflow
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1 border-green-400 text-green-600"
                >
                  <Plus className="size-3" />
                  {stats.additions}
                </Badge>

                <Badge
                  variant="outline"
                  className="gap-1 border-red-400 text-red-600"
                >
                  <Minus className="size-3" />
                  {stats.deletions}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto bg-zinc-950 py-3 font-mono text-[11px] leading-[1.8] sm:text-xs">
              {visibleLines.map((line, index) => (
                <DiffLine
                  key={`${index}-${line.slice(0, 30)}`}
                  line={line}
                />
              ))}
            </div>

            {hasMoreLines && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="flex w-full items-center justify-center gap-2 border-t border-border bg-muted/20 px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="size-3.5" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" />
                    Show all {diffLines.length} lines
                  </>
                )}
              </button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
