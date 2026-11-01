
"use client";

import { useEffect, useState } from "react";

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
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getIntegrityLabel(item: RepairHistoryItem): string {
  if (item.report_integrity === "invalid") {
    return "Report unavailable";
  }

  if (item.report_integrity === "not_available") {
    return "No report yet";
  }

  return item.report_status === "verified"
    ? "Verified"
    : "Unverified";
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

    listRepairs(20, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;

        setRepairs(items);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        if (err instanceof Error && err.name === "AbortError") return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not load repair history."
        );
      })
      .finally(() => {
        if (controller.signal.aborted) return;

        setLoading(false);
        setRefreshing(false);
      });

    return () => controller.abort();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);

    try {
      const items = await listRepairs(20);
      setRepairs(items);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not refresh repair history."
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="recent-activity" aria-label="Recent repair activity">
      <div className="section-heading">
        <div className="history-heading">
          <h2>Recent activity</h2>
          {!loading && !error && (
            <span className="history-count">
              {repairs.length} repair runs
            </span>
          )}
        </div>

        <button
          type="button"
          className="history-refresh"
          onClick={handleRefresh}
          disabled={loading || refreshing}
        > 
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="empty-state" aria-live="polite">
          <p>Loading repair history...</p>
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <h3>Unable to load history</h3>
          <p>{error}</p>
          <button
            type="button"
            className="history-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Try again
          </button>
        </div>
      ) : repairs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">
            ◷
          </div>
          <h3>No repairs yet</h3>
          <p>
            Your repair runs and their verification reports will appear
            here once you start your first repair.
          </p>
        </div>
      ) : (
        <div className="history-list">
          
        {repairs.map((repair) => {
          const content = (
            <div className="history-item-main">
              <div className="history-item-title">
                <span className="history-job-id">
                  Repair {repair.job_id.slice(0, 8)}
                </span>

                <span className={`history-state history-state-${repair.state}`}>
                  {repair.state}
                </span>
              </div>

              <p className="history-summary">
                {repair.report_integrity === "valid"
                  ? repair.summary
                  : repair.report_integrity === "invalid"
                    ? "This historical report does not meet current evidence validation requirements."
                    : "Repair report has not been generated yet."}
              </p>

              <div className="history-item-meta">
                <span>{formatDate(repair.created_at)}</span>

                <span
                  className={`history-integrity history-integrity-${repair.report_integrity}`}
                >
                  {getIntegrityLabel(repair)}
                </span>
              </div>
            </div>
          );

          if (repair.report_integrity === "valid") {
            return (
              <button
                type="button"
                className={`history-item history-item-clickable ${
                  selectedJobId === repair.job_id ? "history-item-selected" : ""
                }`}key={repair.job_id}
                onClick={() => onSelectRepair(repair.job_id)}
                aria-label={`Open verified repair report ${repair.job_id}`}
              >
                {content}
                <span className="history-open-label">View report →</span>
                </button>
              );
            }

             return (
              <article className="history-item" key={repair.job_id}>
                {content}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
