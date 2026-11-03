"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CircleCheck,
  CircleX,
  LoaderCircle,
} from "lucide-react";

import { checkBackendHealth } from "@/lib/api";

type BackendStatus = "connecting" | "connected" | "disconnected";

interface AppHeaderProps {
  title?: string;
  description?: string;
}

export default function AppHeader({
  title = "Developer workspace",
  description,
}: AppHeaderProps) {
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>("connecting");

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      const isHealthy = await checkBackendHealth();

      if (isMounted) {
        setBackendStatus(
          isHealthy ? "connected" : "disconnected"
        );
      }
    };

    void checkHealth();

    const intervalId = window.setInterval(() => {
      void checkHealth();
    }, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const statusConfig = {
    connecting: {
      label: "Connecting",
      icon: LoaderCircle,
      className: "text-muted-foreground",
      dotClassName: "bg-muted-foreground",
      animate: true,
    },
    connected: {
      label: "API connected",
      icon: CircleCheck,
      className: "text-emerald-600",
      dotClassName: "bg-emerald-500",
      animate: false,
    },
    disconnected: {
      label: "API disconnected",
      icon: CircleX,
      className: "text-destructive",
      dotClassName: "bg-destructive",
      animate: false,
    },
  } satisfies Record<
    BackendStatus,
    {
      label: string;
      icon: typeof Activity;
      className: string;
      dotClassName: string;
      animate: boolean;
    }
  >;

  const status = statusConfig[backendStatus];
  const StatusIcon = status.icon;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-5 backdrop-blur-md md:px-8">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold tracking-tight">
          {title}
        </h1>

        {description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <div
        className="ml-4 flex shrink-0 items-center gap-2 rounded-full border bg-background px-3 py-1.5"
        role="status"
        aria-live="polite"
      >
        <span
          className={`size-1.5 rounded-full ${status.dotClassName}`}
        />

        <StatusIcon
          className={`size-3.5 ${status.className} ${
            status.animate ? "animate-spin" : ""
          }`}
        />

        <span
          className={`hidden text-xs font-medium sm:inline ${status.className}`}
        >
          {status.label}
        </span>
      </div>
    </header>
  );
}
