"use client";

import { useState } from "react";

import AppShell from "@/components/layout/AppShell";
import WorkspaceDashboard from "@/components/workspace/WorkspaceDashboard";
import OverviewActivityPanel from "@/components/workspace/OverviewActivityPanel";

export default function Home() {
  const [historyJobId, setHistoryJobId] = useState<string | null>(null);

  const handleClearHistory = () => {
    setHistoryJobId(null);
  };
  return (
    <AppShell
      title="Overview"
      description="Evidence-first code repair"
      aside={<OverviewActivityPanel />}
    >
      <div className="mb-7 space-y-3">
        <div className="eyebrow">
          <span className="eyebrow-mark" />
          AI-powered software repair
        </div>

        <div className="page-heading">
          <h1>What should we fix today?</h1>
          <p>
            Your AI coding agent for investigating bugs,
            generating patches, and proving fixes through
            real execution evidence.
          </p>
        </div>

        <WorkspaceDashboard historyJobId={historyJobId} onHistorySelectionCleared={handleClearHistory} />

        <footer className="footer">
          ProofLoop · Evidence-first AI software repair
        </footer>
      </div>
    </AppShell>
  );
}
