
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  Badge,
} from "@/components/ui/badge";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { FileCode2 } from "lucide-react";

import type { RepairJobResponse } from "@/types/repair";

type RepairReport = NonNullable<RepairJobResponse["report"]>;

interface FileDiffViewerProps {
  report: RepairReport;
}

export default function FileDiffViewer({
  report,
}: FileDiffViewerProps) {
  const changedFiles = report.changed_files ?? [];

  return (
    <div className="space-y-3">
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
                  <AccordionItem
                    value={`hashes-${file.path}`}
                    className="border-b-0"
                  >
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
    </div>
  );
}
