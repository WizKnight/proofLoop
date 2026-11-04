"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Server,
  Settings2,
} from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { checkBackendHealth } from "@/lib/api";

type ConnectionState = "checking" | "connected" | "disconnected";

const API_ENDPOINT = (
  process.env.NEXT_PUBLIC_API_URL || "Same-origin API"
).replace(/\/+$/, "");

export default function SettingsPage() {
  const [connection, setConnection] =
    useState<ConnectionState>("checking");

  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    setConnection("checking");

    try {
      const connected = await checkBackendHealth();

      setConnection(connected ? "connected" : "disconnected");
      setLastChecked(new Date());
    } catch {
      setConnection("disconnected");
      setLastChecked(new Date());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const status = {
    checking: {
      label: "Checking connection",
      description: "Testing communication with the ProofLoop backend.",
      icon: LoaderCircle,
      color: "text-[#7665D8]",
      background: "bg-[#F5F3FF]",
    },
    connected: {
      label: "Connected",
      description: "The backend is responding to health checks.",
      icon: CheckCircle2,
      color: "text-green-700",
      background: "bg-green-100",
    },
    disconnected: {
      label: "Disconnected",
      description: "The backend could not be reached. Check that the API server is running.",
      icon: CircleAlert,
      color: "text-red-700",
      background: "bg-red-50",
    },
  }[connection];

  const StatusIcon = status.icon;

  return (
    <AppShell
      title="Settings"
      description="Application configuration and connection status"
    >
      <div className="mx-auto w-full max-w-3xl space-y-7 pb-12 mt-10">
        {/* Heading */}
        <header>
          <div className="flex size-10 items-center justify-center rounded-xl bg-orange-400 text-black">
            <Settings2 className="size-5" />
          </div>

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0180fa]">
            PREFERENCES
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#292724]">
            Settings
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-[#817B73]">
            View your ProofLoop environment and backend connection.
          </p>
        </header>

        {/* Backend connection */}
        <section className="overflow-hidden rounded-2xl border border-[#EAE7E2] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#EAE7E2] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Server className="size-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-[#34312D]">
                Backend connection
              </h2>
            </div>

            <button
              type="button"
              onClick={checkConnection}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-lg border border-[#EAE7E2] px-3 py-2 text-[11px] font-semibold text-[#57534E] transition-colors bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3.5 ${checking ? "animate-spin" : ""}`}
              />
              Check connection
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${status.background} ${status.color}`}
              >
                <StatusIcon
                  className={`size-4 ${checking ? "animate-spin" : ""}`}
                />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#34312D]">
                  {status.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#817B73]">
                  {status.description}
                </p>
              </div>
            </div>

            <div className="border-t border-[#EAE7E2]" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#89847D]">
                  API endpoint
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[#34312D]">
                  {API_ENDPOINT}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#89847D]">
                  Health endpoint
                </p>
                <p className="mt-1 font-mono text-xs text-[#34312D]">
                  /health
                </p>
              </div>
            </div>

            {lastChecked && (
              <div className="flex items-center gap-1.5 border-t border-[#EAE7E2] pt-3 text-[10px] text-[#89847D]">
                <Clock3 className="size-3" />
                Last checked:{" "}
                {lastChecked.toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            )}
          </div>
        </section>

        {/* Application information */}
        <section className="overflow-hidden rounded-2xl border border-[#EAE7E2] bg-white">
          <div className="flex items-center gap-2.5 border-b border-[#EAE7E2] px-5 py-4">
            <Activity className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-[#34312D]">
              Application information
            </h2>
          </div>

          <div className="divide-y divide-[#EAE7E2] px-5">
            <InfoRow
              label="Application"
              value="ProofLoop"
            />

            <InfoRow
              label="Frontend"
              value="Next.js"
            />

            <InfoRow
              label="Backend"
              value="FastAPI"
            />

            <InfoRow
              label="Repair execution"
              value="Docker sandbox"
            />
          </div>
        </section>

        {/* Configuration note */}
        <div className="rounded-xl bg-[#0180fa] p-4">
          <p className="text-xs font-semibold text-white">
            Configuration
          </p>

          <p className="mt-1 text-xs leading-relaxed text-white/85">
            The API endpoint is configured through the frontend environment
            variable <strong className="font-mono text-white">NEXT_PUBLIC_API_URL</strong>. To change it, update your
            environment configuration and restart the frontend application.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
      <span className="text-xs text-[#817B73]">{label}</span>
      <span className="text-xs font-medium text-[#34312D]">{value}</span>
    </div>
  );
}
