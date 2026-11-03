"use client";

import RepairWorkspace from "@/components/repair/repair-workspace";

interface WorkspaceDashboardProps {
  historyJobId: string | null;
  onHistorySelectionCleared: () => void;
}

export default function WorkspaceDashboard({
  historyJobId,
  onHistorySelectionCleared,
}: WorkspaceDashboardProps) {
  return (
    <RepairWorkspace
    />
  );
}
