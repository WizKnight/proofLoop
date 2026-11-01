"use client";

import { useState } from "react";

import RecentActivity from "@/components/workspace/RecentActivity";
import RepairWorkspace from "@/components/workspace/RepairWorkspace";

export default function WorkspaceDashboard() {
  const [historyJobId, setHistoryJobId] = useState<string | null>(null);

  return (
    <>
      <RepairWorkspace
        historyJobId={historyJobId}
        onHistorySelectionCleared={() => setHistoryJobId(null)}
      />

      <RecentActivity
        selectedJobId={historyJobId}
        onSelectRepair={setHistoryJobId}
      />
    </>
  );
}
