"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileClock,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { listRepairs } from "@/lib/api";
import type { RepairHistoryItem } from "@/types/repair";

type StatusFilter =
  | "all"
  | "queued"
  | "running"
  | "verified"
  | "unverified"
  | "failed";

type SortOrder = "newest" | "oldest";

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All repairs", value: "all" },
  { label: "Queued", value: "queued" },
  { label: "Running", value: "running" },
  { label: "Verified", value: "verified" },
  { label: "Unverified", value: "unverified" },
  { label: "Failed", value: "failed" },
];

function getStatus(item: RepairHistoryItem) {
  if (item.state === "queued") {
    return {
      label: "Queued",
      icon: Clock3,
      className: "bg-stone-100 text-stone-600",
    };
  }

  if (item.state === "running") {
    return {
      label: "Running",
      icon: LoaderCircle,
      className: "bg-violet-50 text-violet-700",
    };
  }

  if (item.state === "failed") {
    return {
      label: "Failed",
      icon: XCircle,
      className: "bg-red-50 text-red-700",
    };
  }

  if (item.report_status === "verified") {
    return {
      label: "Verified",
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "Unverified",
    icon: CircleAlert,
    className: "bg-amber-50 text-amber-700",
  };
}

function matchesFilter(
  item: RepairHistoryItem,
  filter: StatusFilter
) {
  if (filter === "all") return true;

  if (filter === "queued" || filter === "running" || filter === "failed") {
    return item.state === filter;
  }

  if (filter === "verified") {
    return (
      item.state === "completed" &&
      item.report_status === "verified"
    );
  }

  return (
    item.state === "completed" &&
    item.report_status !== "verified"
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getTitle(item: RepairHistoryItem) {
  const summary = item.summary?.trim();

  if (summary) return summary;

  return `Repair ${item.job_id.slice(0, 8)}`;
}

function getIntegrity(item: RepairHistoryItem) {
  switch (item.report_integrity) {
    case "valid":
      return "Valid";
    case "invalid":
      return "Invalid";
    default:
      return "Not available";
  }
}

export default function HistoryPage() {
  const [repairs, setRepairs] = useState<RepairHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  const fetchRepairs = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);

      // Fetch a larger batch for client-side filtering and sorting.
      const items = await listRepairs(100);

      if (!signal?.aborted) {
        setRepairs(items);
      }
    } catch (err) {
      if (signal?.aborted) return;

      setError(
        err instanceof Error
          ? err.message
          : "Unable to retrieve repair history."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
        void fetchRepairs(controller.signal);
    });

    return () => controller.abort();
  }, [fetchRepairs]);

  const filteredRepairs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return repairs
      .filter((item) => matchesFilter(item, filter))
      .filter((item) => {
        if (!query) return true;

        return (
          item.job_id.toLowerCase().includes(query) ||
          (item.summary ?? "").toLowerCase().includes(query) ||
          (item.error ?? "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const first = new Date(a.created_at).getTime();
        const second = new Date(b.created_at).getTime();

        return sort === "newest"
          ? second - first
          : first - second;
      });
  }, [repairs, search, filter, sort]);

  const counts = useMemo(() => {
    return {
      total: repairs.length,
      verified: repairs.filter(
        (item) =>
          item.state === "completed" &&
          item.report_status === "verified"
      ).length,
      running: repairs.filter(
        (item) =>
          item.state === "queued" ||
          item.state === "running"
      ).length,
      failed: repairs.filter(
        (item) => item.state === "failed"
      ).length,
    };
  }, [repairs]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchRepairs();
  }

  return (
    <AppShell
      title="Repair history"
      description="Browse and revisit previous repair jobs"
    >
      <div className="mx-auto w-full max-w-5xl space-y-7 pb-10">

        {/* Page heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-mark" />
              REPAIR ARCHIVE
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#292724]">
              Your repair history
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#89847D]">
              Review previous investigations, revisit execution
              evidence, and inspect verified repairs.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-[#EAE7E2] bg-white px-3 text-xs font-semibold text-[#57534E] transition-colors hover:bg-[#FAF9F7] disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw
              className={`size-3.5 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            Refresh
          </button>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SummaryCard
            label="Total repairs"
            value={counts.total}
            icon={FileClock}
          />
          <SummaryCard
            label="Verified"
            value={counts.verified}
            icon={CheckCircle2}
          />
          <SummaryCard
            label="In progress"
            value={counts.running}
            icon={Clock3}
          />
          <SummaryCard
            label="Failed"
            value={counts.failed}
            icon={XCircle}
          />
        </div>

        {/* Search and filters */}
        <section className="rounded-2xl border border-[#EAE7E2] bg-white p-4 shadow-[0_4px_20px_rgba(35,30,20,0.025)] sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A49D93]" />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by summary, job ID, or error..."
                className="h-10 w-full rounded-xl border border-[#EAE7E2] bg-[#FAF9F7] pl-9 pr-3 text-sm text-[#34312D] outline-none transition-all placeholder:text-[#A49D93] focus:border-[#C8BFF4] focus:ring-2 focus:ring-[#F1EEFF]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-[#89847D]">
                Sort by
              </span>

              <button
                type="button"
                onClick={() =>
                  setSort((current) =>
                    current === "newest" ? "oldest" : "newest"
                  )
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#EAE7E2] bg-white px-3 text-xs font-semibold text-[#57534E] transition-colors hover:bg-[#FAF9F7]"
              >
                {sort === "newest" ? (
                  <>
                    <ArrowDown className="size-3.5" />
                    Newest first
                  </>
                ) : (
                  <>
                    <ArrowUp className="size-3.5" />
                    Oldest first
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const active = filter === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#292724] text-white"
                      : "bg-[#F5F3F0] text-[#777168] hover:bg-[#ECE9E4] hover:text-[#34312D]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Repair records */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#34312D]">
              Repair records
            </h2>

            <span className="text-xs text-[#89847D]">
              {filteredRepairs.length}{" "}
              {filteredRepairs.length === 1 ? "result" : "results"}
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-52 items-center justify-center gap-2 rounded-2xl border border-[#EAE7E2] bg-white text-sm text-[#89847D]">
              <LoaderCircle className="size-4 animate-spin" />
              Loading repair history...
            </div>
          ) : error && repairs.length === 0 ? (
            <div className="rounded-2xl border border-[#EAE7E2] bg-white px-5 py-12 text-center">
              <CircleAlert className="mx-auto size-6 text-[#A49D93]" />
              <h3 className="mt-3 text-sm font-semibold text-[#34312D]">
                Unable to load repair history
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#89847D]">
                {error}
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-4 text-xs font-semibold text-[#7163C7] hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filteredRepairs.length === 0 ? (
            <div className="rounded-2xl border border-[#EAE7E2] bg-white px-5 py-14 text-center">
              <FileClock className="mx-auto size-7 text-[#B1AAA0]" />

              <h3 className="mt-3 text-sm font-semibold text-[#34312D]">
                {repairs.length === 0
                  ? "No repair records yet"
                  : "No matching repairs"}
              </h3>

              <p className="mt-2 text-xs text-[#89847D]">
                {repairs.length === 0
                  ? "Your submitted repair jobs will appear here."
                  : "Try changing your search or selected filters."}
              </p>

              {(search || filter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                  className="mt-4 text-xs font-semibold text-[#7163C7] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRepairs.map((item) => {
                const status = getStatus(item);
                const StatusIcon = status.icon;

                return (
                  <Link
                    key={item.job_id}
                    href={`/repairs/${encodeURIComponent(item.job_id)}`}
                    className="group block rounded-2xl border border-[#EAE7E2] bg-white p-4 shadow-[0_2px_12px_rgba(35,30,20,0.015)] transition-all hover:border-[#D9D1F5] hover:shadow-[0_6px_24px_rgba(35,30,20,0.045)] sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${status.className}`}
                          >
                            <StatusIcon
                              className={`size-3 ${
                                item.state === "running"
                                  ? "animate-spin"
                                  : ""
                              }`}
                            />
                            {status.label}
                          </span>

                          {item.report_integrity !== "not_available" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F3F0] px-2 py-1 text-[10px] font-medium text-[#777168]">
                              <ShieldCheck className="size-3" />
                              Integrity: {getIntegrity(item)}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-relaxed text-[#34312D] transition-colors group-hover:text-[#7163C7]">
                          {getTitle(item)}
                        </h3>

                        <p className="mt-2 break-all font-mono text-[10px] text-[#A19A90]">
                          {item.job_id}
                        </p>

                        {item.error && (
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#A16B62]">
                            {item.error}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#F0EDE8] pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                        <span className="text-[11px] text-[#89847D]">
                          {formatDate(item.created_at)}
                        </span>

                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#7163C7]">
                          Open session
                          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-[#EAE7E2] bg-white p-4 shadow-[0_4px_20px_rgba(35,30,20,0.02)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[#89847D]">{label}</p>
        <Icon className="size-4 text-[#A49D93]" />
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-[#292724] tabular-nums">
        {value}
      </p>
    </div>
  );
}
