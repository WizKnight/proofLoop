"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Search,
} from "lucide-react";

import { listRepairs } from "@/lib/api";
import type { RepairHistoryItem } from "@/types/repair";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 7;
const REFRESH_INTERVAL = 5000;

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getDateGroup(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Earlier";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const itemDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  if (itemDate.getTime() === today.getTime()) return "Today";
  if (itemDate.getTime() === yesterday.getTime()) return "Yesterday";

  return "Previous";
}

function getSessionTitle(item: RepairHistoryItem): string {
  // The current history API returns a generic summary for some jobs.
  // Use it only when it is meaningfully different from the generic fallback.
  const summary = item.summary?.trim();

  if (
    summary &&
    summary.length <= 52 &&
    !summary.toLowerCase().startsWith("the baseline failure was reproduced")
  ) {
    return summary;
  }

  return `Repair ${item.job_id.slice(0, 8)}`;
}

function getStatus(item: RepairHistoryItem) {
  if (item.state === "queued") {
    return {
      label: "Queued",
      icon: Clock3,
      className: "text-amber-700",
    };
  }

  if (item.state === "running") {
    return {
      label: "Running",
      icon: LoaderCircle,
      className: "text-[#7665D8]",
    };
  }

  if (item.state === "failed") {
    return {
      label: "Failed",
      icon: AlertCircle,
      className: "text-red-600",
    };
  }

  if (item.report_integrity === "invalid") {
    return {
      label: "Invalid report",
      icon: AlertCircle,
      className: "text-red-600",
    };
  }

  if (item.report_integrity === "not_available") {
    return {
      label: "No report",
      icon: Clock3,
      className: "text-[#817B73]",
    };
  }

  if (item.report_status === "verified") {
    return {
      label: "Verified",
      icon: CheckCircle2,
      className: "text-green-600",
    };
  }

  return {
    label: "Unverified",
    icon: AlertCircle,
    className: "text-amber-700",
  };
}

export default function RecentActivity() {
  const pathname = usePathname();

  const [repairs, setRepairs] = useState<RepairHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadRepairs = useCallback(async (signal?: AbortSignal) => {
    try {
      const items = await listRepairs(RECENT_LIMIT, signal);

      if (signal?.aborted) return;

      setRepairs(items);
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      if (err instanceof Error && err.name === "AbortError") return;

      setError(
        err instanceof Error
          ? err.message
          : "Could not load recent repair sessions."
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadRepairs(controller.signal);

    return () => controller.abort();
  }, [loadRepairs]);

  useEffect(() => {
    const hasActiveJobs = repairs.some(
      (repair) =>
        repair.state === "queued" || repair.state === "running"
    );

    if (!hasActiveJobs) return;

    const controller = new AbortController();

    const timer = setTimeout(() => {
      void loadRepairs(controller.signal);
    }, REFRESH_INTERVAL);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [repairs, loadRepairs]);

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await loadRepairs();
    } finally {
      setRefreshing(false);
    }
  }

  const filteredRepairs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return repairs;

    return repairs.filter((repair) => {
      const title = getSessionTitle(repair).toLowerCase();
      const jobId = repair.job_id.toLowerCase();
      const summary = repair.summary?.toLowerCase() ?? "";

      return (
        title.includes(query) ||
        jobId.includes(query) ||
        summary.includes(query)
      );
    });
  }, [repairs, search]);

  const groups = useMemo(() => {
    const grouped = new Map<string, RepairHistoryItem[]>();

    for (const repair of filteredRepairs) {
      const label = getDateGroup(repair.created_at);
      const items = grouped.get(label) ?? [];

      items.push(repair);
      grouped.set(label, items);
    }

    return Array.from(grouped.entries());
  }, [filteredRepairs]);

  return (
    <section aria-label="Recent repair sessions" className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#858078]">
          Recent repairs
        </h2>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          aria-label="Refresh recent repairs"
          title="Refresh"
          className="rounded-md p-1 text-[#817B73] transition-colors hover:bg-white/70 hover:text-[#292724] disabled:opacity-40"
        >
          <LoaderCircle
            className={cn(
              "size-3.5",
              (refreshing || loading) && "animate-spin"
            )}
          />
        </button>
      </div>

      {repairs.length > 0 && (
        <div className="relative px-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#99938A]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search recent repairs"
            aria-label="Search recent repairs"
            className="h-8 w-full rounded-lg border border-[#E4DFD7] bg-white/55 pl-8 pr-3 text-[11px] text-[#292724] outline-none transition-colors placeholder:text-[#99938A] focus:border-[#A99DEB] focus:bg-white"
          />
        </div>
      )}

      {loading && repairs.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-4 text-[11px] text-[#817B73]">
          <LoaderCircle className="size-3.5 animate-spin" />
          Loading recent repairs...
        </div>
      ) : error && repairs.length === 0 ? (
        <div className="px-3 py-2">
          <p className="text-[11px] leading-relaxed text-red-600">
            Unable to load recent repairs.
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-2 text-[11px] font-medium text-[#514D47] underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      ) : filteredRepairs.length === 0 ? (
        <p className="px-3 py-3 text-[11px] leading-relaxed text-[#817B73]">
          {search
            ? "No matching repair sessions."
            : "Your recent repairs will appear here."}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(([group, items]) => (
            <div key={group} className="space-y-1">
              <p className="px-3 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#99938A]">
                {group}
              </p>

              {items.map((repair) => {
                const href = `/repairs/${encodeURIComponent(repair.job_id)}`;
                const selected = pathname === href;
                const status = getStatus(repair);
                const StatusIcon = status.icon;

                return (
                  <Link
                    key={repair.job_id}
                    href={href}
                    aria-current={selected ? "page" : undefined}
                    title={`${getSessionTitle(repair)} · ${status.label}`}
                    className={cn(
                      "group block rounded-xl border px-3 py-2.5 transition-colors",
                      selected
                        ? "border-white bg-blue-100 shadow-sm"
                        : "border-transparent hover:border-[#E4DFD7] hover:bg-blue-50"
                    )}
                  >
                    <p
                      className={cn(
                        "truncate text-[12px] font-medium",
                        selected ? "text-[#292724]" : "text-black"
                      )}
                    >
                      {getSessionTitle(repair)}
                    </p>

                    <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-[10px] text-[#89847D]">
                        {formatDate(repair.created_at)}
                      </span>

                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 text-[10px] font-medium",
                          status.className
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            "size-3",
                            repair.state === "running" && "animate-spin"
                          )}
                        />
                        {status.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <Link
        href="/history"
        className="flex items-center justify-between rounded-lg px-3 py-2 text-[11px] font-medium text-[#7165C5] transition-colors hover:bg-blue-50"
      >
        View all repairs
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
