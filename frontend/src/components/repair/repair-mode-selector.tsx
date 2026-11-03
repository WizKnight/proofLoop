
"use client";

import { Bug, Check, FolderCode } from "lucide-react";

export type RepairMode = "demo" | "repository";

interface RepairModeSelectorProps {
  mode: RepairMode;
  onModeChange: (mode: RepairMode) => void;
  disabled?: boolean;
}

const workflows = [
  {
    id: "demo" as const,
    title: "Investigate a bug",
    description: "Diagnose a specific failure and generate a verified fix.",
    icon: Bug,
  },
  {
    id: "repository" as const,
    title: "Repair a repository",
    description: "Upload a Python project and investigate failing tests.",
    icon: FolderCode,
  },
];

export default function RepairModeSelector({
  mode,
  onModeChange,
  disabled = false,
}: RepairModeSelectorProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight text-[#292724]">
            Choose your workflow
          </h2>
          <p className="mt-1 text-xs text-[#89847D]">
            How should ProofLoop investigate your problem?
          </p>
        </div>

        <span className="hidden text-[10px] font-medium uppercase tracking-[0.12em] text-[#A19A90] sm:inline">
          Select a mode
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {workflows.map((workflow) => {
          const selected = mode === workflow.id;
          const Icon = workflow.icon;

          return (
            <button
              key={workflow.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onModeChange(workflow.id)}
              className={`group relative flex min-h-[104px] items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                selected
                  ? "border-[#C9C0F1] bg-[#F8F6FF] shadow-[0_2px_8px_rgba(89,70,160,0.045)]"
                  : "border-[#EAE7E2] bg-white/65 hover:border-[#D8D2E8] hover:bg-white"
              } disabled:pointer-events-none disabled:opacity-50`}
            >
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  selected
                    ? "bg-[#EAE5FF] text-[#7665D8]"
                    : "bg-[#F4F2EF] text-[#77716A] group-hover:bg-[#EEEBF6]"
                }`}
              >
                <Icon className="size-[17px]" strokeWidth={1.8} />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[12px] font-semibold text-[#34312D]">
                    {workflow.title}
                  </h3>

                  {selected && (
                    <span className="flex size-[19px] shrink-0 items-center justify-center rounded-full bg-[#7665D8] text-white">
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-[11px] leading-[1.55] text-[#89847D]">
                  {workflow.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
