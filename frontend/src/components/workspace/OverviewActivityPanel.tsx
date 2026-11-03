"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { listRepairs } from "@/lib/api";
import type { RepairHistoryItem } from "@/types/repair";

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

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getRepairTitle(item: RepairHistoryItem) {
  const summary = item.summary?.trim();

  if (summary) {
    return summary.length > 72
      ? `${summary.slice(0, 69)}...`
      : summary;
  }

  return `Repair ${item.job_id.slice(0, 8)}`;
}

export default function OverviewActivityPanel() {
  const [repairs, setRepairs] = useState<RepairHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRepairs = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);

      const items = await listRepairs(6, signal);

      if (!signal?.aborted) {
        setRepairs(items);
      }
    } catch (err) {
      if (signal?.aborted) return;

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load recent repairs."
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

    void fetchRepairs(controller.signal);

    const intervalId = window.setInterval(() => {
      void fetchRepairs();
    }, 15000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [fetchRepairs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRepairs();
  };

  return (
    <section className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-[#EAE7E2] bg-white/80 p-4 shadow-[0_4px_20px_rgba(35,30,20,0.025)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight text-[#292724]">
            Recent activity
          </h2>
          <p className="mt-1 text-[11px] text-[#89847D]">
            Your latest repair jobs
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          aria-label="Refresh recent repairs"
          className="flex size-8 items-center justify-center rounded-lg text-[#858078] transition-colors hover:bg-[#F5F3F0] hover:text-[#292724] disabled:opacity-50"
        >
          <RefreshCw
            className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-xs text-[#89847D]">
            <LoaderCircle className="size-4 animate-spin" />
            Loading activity...
          </div>
        ) : error && repairs.length === 0 ? (
          <div className="rounded-xl bg-[#FAF9F7] px-3 py-5 text-center">
            <CircleAlert className="mx-auto size-5 text-[#A49D93]" />
            <p className="mt-2 text-xs font-medium text-[#57534E]">
              Activity unavailable
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#89847D]">
              {error}
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-3 text-xs font-semibold text-[#7665D8] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : repairs.length === 0 ? (
          <div className="rounded-xl bg-[#FAF9F7] px-3 py-7 text-center">
            <ShieldCheck className="mx-auto size-5 text-[#A49D93]" />
            <p className="mt-2 text-xs font-medium text-[#57534E]">
              No repairs yet
            </p>
            <p className="mt-1 text-[11px] text-[#89847D]">
              Your recent repair activity will appear here.
            </p>
          </div>
        ) : (
          repairs.map((item) => {
            const status = getStatus(item);
            const StatusIcon = status.icon;

            return (
              <Link
                key={item.job_id}
                href={`/repairs/${encodeURIComponent(item.job_id)}`}
                className="group block w-full rounded-xl border border-transparent bg-[#FAF9F7] p-3 text-left transition-all hover:border-[#EAE7E2] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9AEED]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold leading-relaxed text-[#34312D]">
                    {getRepairTitle(item)}
                  </p>

                  <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-[#A39D94] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${status.className}`}
                  >
                    <StatusIcon
                      className={`size-3 ${
                        item.state === "running" ? "animate-spin" : ""
                      }`}
                    />
                    {status.label}
                  </span>

                  <span className="text-[10px] text-[#969087]">
                    {formatDate(item.created_at)}
                  </span>
                </div>

                {item.report_integrity !== "not_available" && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#89847D]">
                    <ShieldCheck className="size-3" />
                    Report integrity: {item.report_integrity}
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>

      <div className="mt-3 shrink-0 border-t border-[#EEEAE5] pt-3">
        <Link
          href="/history"
          className="flex items-center justify-between rounded-lg px-2 py-2 text-xs font-semibold text-[#7163C7] transition-colors hover:bg-[#F7F5FC]"
        >
          View all repairs
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
