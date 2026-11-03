"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import RepairSession from "@/components/repair/repair-session";

function RepairSessionContent() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId ?? "";

  return <RepairSession jobId={jobId} />;
}

export default function RepairSessionPage() {
  return (
    <AppShell
      title="Repair session"
      description="Investigation, execution and verification"
    >
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading session...</div>}>
        <RepairSessionContent />
      </Suspense>
    </AppShell>
  );
}