"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  clearDemoAccessToken,
  getDemoAccessToken,
  storeDemoAccessToken,
  verifyDemoAccess,
} from "@/lib/api";

type GateStatus =
  | "checking"
  | "locked"
  | "unlocked"
  | "unavailable";

export default function DemoAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<GateStatus>("checking");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function checkExistingSession() {
    const token = getDemoAccessToken();

    if (!token) {
      setStatus("locked");
      return;
    }

    setStatus("checking");
    setError("");

    try {
      const valid = await verifyDemoAccess(token);

      if (valid) {
        setStatus("unlocked");
      } else {
        clearDemoAccessToken();
        setStatus("locked");
        setError("Your session has expired. Enter the access code again.");
      }
    } catch {
      setStatus("unavailable");
      setError(
        "ProofLoop could not reach the backend. Check your connection and retry."
      );
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const token = getDemoAccessToken();

      if (!token) {
        setStatus("locked");
        return;
      }

      try {
        const valid = await verifyDemoAccess(token);

        if (cancelled) return;

        if (valid) {
          setStatus("unlocked");
        } else {
          clearDemoAccessToken();
          setStatus("locked");
          setError("Your session has expired. Enter the access code again.");
        }
      } catch {
        if (cancelled) return;

        setStatus("unavailable");
        setError(
          "ProofLoop could not reach the backend. Check your connection and retry."
        );
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const candidate = accessCode.trim();

    if (!candidate) {
      setError("Enter the demo access code.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const valid = await verifyDemoAccess(candidate);

      if (!valid) {
        setError("That access code is not valid.");
        return;
      }

      storeDemoAccessToken(candidate);
      setAccessCode("");
      setStatus("unlocked");
    } catch {
      setError(
        "Unable to verify the access code. Please try again when the backend is available."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleLock() {
    clearDemoAccessToken();
    setAccessCode("");
    setError("");
    setStatus("locked");
  }

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1020] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/60">
            Verifying ProofLoop session...
          </p>
        </div>
      </main>
    );
  }

  if (status !== "unlocked") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1020] px-5 py-10 text-white">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl font-semibold">
              P
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">
              ProofLoop
            </p>

            <h1 className="text-3xl font-semibold tracking-tight">
              Demo workspace
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/55">
              Enter your shared demo access code to explore AI-powered
              code repair and evidence-backed verification.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl"
          >
            <label
              htmlFor="demo-access-code"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Demo access code
            </label>

            <input
              id="demo-access-code"
              type="password"
              autoComplete="current-password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Enter access code"
              disabled={submitting || status === "unavailable"}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-blue-400/70 focus:ring-2 focus:ring-blue-400/20 disabled:opacity-50"
            />

            {error && (
              <p
                role="alert"
                className="mt-3 text-sm leading-5 text-red-300"
              >
                {error}
              </p>
            )}

            {status === "unavailable" ? (
              <button
                type="button"
                onClick={() => void checkExistingSession()}
                className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-blue-100"
              >
                Retry connection
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="mt-5 w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Verifying..." : "Unlock workspace"}
              </button>
            )}

            <p className="mt-5 text-center text-xs text-white/35">
              Authorized demo access only
            </p>
          </form>
        </div>
      </main>
    );
  }

  return (
    <>
      {children}

      <button
        type="button"
        onClick={handleLock}
        title="Lock this demo session"
        className="fixed bottom-5 right-5 z-[100] rounded-full border border-white/15 bg-slate-950/90 px-4 py-2 text-xs font-medium text-white/75 shadow-lg backdrop-blur transition hover:border-white/30 hover:text-white"
      >
        Lock session
      </button>
    </>
  );
}
