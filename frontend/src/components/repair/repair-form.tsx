"use client";

import type { ChangeEvent, FormEvent, RefObject } from "react";

import {
  ArrowUp,
  FileArchive,
  FileCode2,
  ShieldCheck,
  X,
} from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import RepairModeSelector, {
  type RepairMode,
} from "@/components/repair/repair-mode-selector";

interface RepairFormProps {
  mode: RepairMode;
  onModeChange: (mode: RepairMode) => void;

  bugReport: string;
  onBugReportChange: (value: string) => void;

  expectedFailure: string;
  onExpectedFailureChange: (value: string) => void;

  repositoryFile: File | null;
  onRepositoryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;

  submitting: boolean;
  active: boolean;

  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function RepairForm({
  mode,
  onModeChange,
  bugReport,
  onBugReportChange,
  expectedFailure,
  onExpectedFailureChange,
  repositoryFile,
  onRepositoryChange,
  fileInputRef,
  submitting,
  active,
  onSubmit,
}: RepairFormProps) {
  const disabled = submitting || active;

  const canSubmit =
    bugReport.trim().length >= 10 &&
    bugReport.trim().length <= 4000 &&
    (mode === "demo" ||
      (repositoryFile !== null && expectedFailure.trim().length > 0));

  return (
    <div className="space-y-5">
      <RepairModeSelector
        mode={mode}
        onModeChange={onModeChange}
        disabled={disabled}
      />

      <form
        onSubmit={onSubmit}
        className="overflow-hidden rounded-2xl border border-[#E7E3DD] bg-white shadow-[0_8px_30px_rgba(40,32,20,0.035)] transition-all duration-200 focus-within:border-[#C9C0F1] focus-within:shadow-[0_0_0_3px_rgba(118,101,216,0.07)]"
      >
        {/* Composer heading */}
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#F3F0EB] text-[#706A62]">
              <FileCode2 className="size-4" strokeWidth={1.8} />
            </div>

            <div>
              <p className="text-[13px] font-semibold tracking-tight text-[#292724]">
                New repair
              </p>
              <p className="mt-0.5 text-[11px] text-[#89847D]">
                {mode === "demo"
                  ? "Describe the problem you want to solve."
                  : "Upload your project and identify the failing test."}
              </p>
            </div>
          </div>

          <span className="hidden rounded-full border border-[#EAE7E2] px-2.5 py-1 text-[10px] font-medium text-[#89847D] sm:inline-flex">
            {mode === "demo" ? "Bug investigation" : "Repository repair"}
          </span>
        </div>

        {/* Repository upload */}
        {mode === "repository" && (
          <div className="px-5 pt-3 sm:px-6">
            <input
              ref={fileInputRef}
              id="repository-zip"
              type="file"
              accept=".zip,application/zip"
              onChange={onRepositoryChange}
              disabled={disabled}
              className="sr-only"
            />

            {repositoryFile ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#DCEBE2] bg-[#F7FBF8] p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E7F3EA] text-[#278457]">
                  <FileArchive className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#34312D]">
                    {repositoryFile.name}
                  </p>
                  <p className="mt-1 text-[10px] text-[#89847D]">
                    {(repositoryFile.size / (1024 * 1024)).toFixed(2)} MB
                    {" · "}ZIP archive
                  </p>
                </div>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => {
                      onRepositoryChange({
                        target: { files: null },
                      } as unknown as ChangeEvent<HTMLInputElement>);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    aria-label="Remove repository"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#89847D] transition-colors hover:bg-white hover:text-[#B34B43]"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ) : (
              <label
                htmlFor="repository-zip"
                className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#DCD7CF] bg-[#FAF9F7] p-3.5 transition-colors hover:border-[#BDB3E9] hover:bg-[#F9F7FF] ${
                  disabled ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#7665D8] shadow-sm">
                  <FileArchive className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#34312D]">
                    Choose a Python repository
                  </p>
                  <p className="mt-1 text-[10px] text-[#89847D]">
                    ZIP archive · Maximum 25 MB
                  </p>
                </div>

                <span className="rounded-lg border border-[#E7E2DA] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#625B52]">
                  Browse
                </span>
              </label>
            )}
          </div>
        )}

        {/* Bug description */}
        <div className="px-5 pb-4 pt-3 sm:px-6 sm:pb-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label
              htmlFor="bug-report"
              className="text-[11px] font-semibold text-[#5F5A52]"
            >
              {mode === "demo" ? "Describe the bug" : "What needs to be fixed?"}
            </Label>

            <span
              className={`text-[10px] tabular-nums ${
                bugReport.length > 4000
                  ? "text-red-600"
                  : "text-[#A19A90]"
              }`}
            >
              {bugReport.length.toLocaleString()} / 4,000
            </span>
          </div>

          <Textarea
            id="bug-report"
            value={bugReport}
            onChange={(event) => onBugReportChange(event.target.value)}
            placeholder={`Describe what went wrong, what you expected, and what actually happened...

Example: calculate_discount returns the original price when discount_percent is 100. A full discount should return zero.`}
            minLength={10}
            maxLength={4000}
            required
            disabled={disabled}
            className="min-h-[145px] resize-y rounded-xl border-[#ECE8E2] bg-[#FCFBF9] px-4 py-3 text-[12px] leading-[1.8] text-[#34312D] shadow-none placeholder:text-[#AAA49A] focus-visible:border-[#C9C0F1] focus-visible:ring-2 focus-visible:ring-[#7665D8]/10 sm:min-h-[155px]"
          />

          <p className="mt-2 text-[10px] leading-relaxed text-[#969087]">
            Be specific about the expected behaviour and the observed failure.
          </p>
        </div>

        {/* Repository-specific failure marker */}
        {mode === "repository" && (
          <div className="border-t border-[#F0EDE8] px-5 py-4 sm:px-6">
            <div className="space-y-2">
              <Label
                htmlFor="expected-failure"
                className="text-[11px] font-semibold text-[#5F5A52]"
              >
                Expected failure marker
              </Label>

              <Input
                id="expected-failure"
                type="text"
                value={expectedFailure}
                onChange={(event) =>
                  onExpectedFailureChange(event.target.value)
                }
                placeholder="e.g. AssertionError: expected 0, got 100"
                maxLength={300}
                required
                disabled={disabled}
                className="h-10 rounded-xl border-[#ECE8E2] bg-[#FCFBF9] text-xs shadow-none placeholder:text-[#AAA49A] focus-visible:border-[#C9C0F1] focus-visible:ring-2 focus-visible:ring-[#7665D8]/10"
              />

              <p className="text-[10px] leading-relaxed text-[#969087]">
                A distinctive message expected in the failing baseline test output.
              </p>
            </div>
          </div>
        )}

        {/* Composer actions */}
        <div className="flex flex-col gap-3 border-t border-[#EEEAE5] bg-[#FDFCFA] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-[10px] text-[#817B73]">
            <ShieldCheck className="size-3.5 shrink-0 text-[#27966B]" />
            <span>Execution-backed verification</span>
            <span className="text-[#C2BCB2]">·</span>
            <span className="truncate">
              {mode === "demo" ? "Demo fixture" : "Python repository"}
            </span>
          </div>

          <button
            type="submit"
            disabled={disabled || !canSubmit}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#292724] px-4 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#403C37] hover:shadow-md disabled:pointer-events-none disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {submitting
              ? "Submitting..."
              : active
                ? "Repair in progress"
                : "Start investigation"}

            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
