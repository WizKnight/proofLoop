"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import Link from "next/link";

import { listRepairs } from "@/lib/api";
import type { RepairHistoryItem } from "@/types/repair";

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getIntegrityLabel(item: RepairHistoryItem): string {
  if (item.report_integrity === "invalid") return "Unavailable";
  if (item.report_integrity === "not_available") return "No report yet";

  return item.report_status === "verified" ? "Verified" : "Unverified";
}

export default function RecentActivity({
  selectedJobId,
  onSelectRepair,
}: {
  selectedJobId: string | null;
  onSelectRepair: (jobId: string) => void;
}) {
  const [repairs, setRepairs] = useState<RepairHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    listRepairs(5, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setRepairs(items);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.name === "AbortError") return;

        setError(
          err instanceof Error ? err.message : "Could not load repair history."
        );
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);

    try {
      const items = await listRepairs(5);
      setRepairs(items);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not refresh repair history."
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section aria-label="Recent repairs" className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Recent repairs
        </h2>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          aria-label="Refresh recent repairs"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          Loading repairs...
        </p>
      ) : error ? (
        <div className="px-2 py-2">
          <p className="text-xs text-destructive">{error}</p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-2 text-xs font-medium text-foreground underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      ) : repairs.length === 0 ? (
        <p className="px-2 py-3 text-xs leading-relaxed text-muted-foreground">
          No repair runs yet. Your recent repairs will appear here.
        </p>
      ) : (
        <div className="space-y-1">
          {repairs.map((repair) => {
            const selectable = repair.report_integrity === "valid";
            const selected = selectedJobId === repair.job_id;

            const content = (
              <>
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">
                    Repair {repair.job_id.slice(0, 8)}
                  </span>

                  {repair.report_integrity === "valid" &&
                  repair.report_status === "verified" ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <Clock3 className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </div>

                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatDate(repair.created_at)}
                </p>

                <p className="mt-1 text-[10px] text-muted-foreground">
                  {getIntegrityLabel(repair)}
                </p>
              </>
            );

            return selectable ? (
              <button
                key={repair.job_id}
                type="button"
                onClick={() => onSelectRepair(repair.job_id)}
                aria-pressed={selected}
                aria-label={`Open repair ${repair.job_id}`}
                className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? "border-primary/30 bg-accent text-accent-foreground"
                    : "border-transparent hover:border-border hover:bg-muted/70"
                }`}
              >
                {content}
              </button>
            ) : (
              <div
                key={repair.job_id}
                className="rounded-md px-3 py-2.5 text-left text-muted-foreground"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/history"
        className="block px-2 pt-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        View all repairs →
      </Link>
    </section>
  );
}