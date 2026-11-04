"use client";

import RepairWorkspace from "@/components/repair/repair-workspace";

interface WorkspaceDashboardProps {
  historyJobId: string | null;
  onHistorySelectionCleared: () => void;
}

export default function WorkspaceDashboard({
  historyJobId: _historyJobId,
  onHistorySelectionCleared: _onHistorySelectionCleared,
}: WorkspaceDashboardProps) {
  return (
    <RepairWorkspace
    />
  );
}
