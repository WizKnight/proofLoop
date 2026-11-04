"use client";

import AppShell from "@/components/layout/AppShell";
import WorkspaceDashboard from "@/components/workspace/WorkspaceDashboard";

export default function Home() {
  return (
    <AppShell
      showHeader={false}
      centered
    >
      <div className="space-y-10 mt-10">
        {/* Hero */}
        <header className="mx-auto max-w-xl space-y-4 text-center">
          <div className="eyebrow justify-center">
            <span className="eyebrow-mark" />
            AI-powered bug repair
          </div>

          <div className="page-heading space-y-2">
            <h1>What should we fix today?</h1>

            <p>
              An AI coding agent that investigates bugs, applies patches,
              and checks fixes through real test execution.
            </p>
          </div>
        </header>

        {/* Repair workspace */}
        <div className="w-full">
          <WorkspaceDashboard historyJobId={null} onHistorySelectionCleared={function (): void {
            throw new Error("Function not implemented.");
          } } />
        </div>

        {/* Footer */}
        <footer className="pt-2 text-center text-[12px] text-black/85">
          ProofLoop · Evidence-first AI bug repair
        </footer>
      </div>
    </AppShell>
  );
}
