"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ChangeEvent, FormEvent } from "react";

import {
  submitRepair,
  submitRepositoryRepair,
} from "@/lib/api";

import type { RepairMode } from "@/components/repair/repair-mode-selector";

import RepairForm from "@/components/repair/repair-form";

const MAX_REPOSITORY_SIZE = 25 * 1024 * 1024;

export default function RepairWorkspace() {
  const router = useRouter();

  const [mode, setMode] = useState<RepairMode>("demo");

  const [bugReport, setBugReport] = useState("");
  const [expectedFailure, setExpectedFailure] = useState("");
  const [repositoryFile, setRepositoryFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModeChange = useCallback(
    (nextMode: RepairMode) => {
      if (submitting || mode === nextMode) return;

      setMode(nextMode);
      setError(null);

      setRepositoryFile(null);
      setExpectedFailure("");
      setBugReport("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [submitting, mode]
  );

  function handleRepositoryChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] ?? null;

    setError(null);

    if (!file) {
      setRepositoryFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setRepositoryFile(null);
      setError("Please select a ZIP archive.");
      event.target.value = "";
      return;
    }

    if (file.size === 0) {
      setRepositoryFile(null);
      setError("The selected ZIP archive is empty.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_REPOSITORY_SIZE) {
      setRepositoryFile(null);
      setError("The ZIP archive must be 25 MB or smaller.");
      event.target.value = "";
      return;
    }

    setRepositoryFile(file);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) return;

    const description = bugReport.trim();
    const failure = expectedFailure.trim();

    if (description.length < 10 || description.length > 4000) {
      setError(
        "Bug description must be between 10 and 4,000 characters."
      );
      return;
    }

    if (mode === "repository") {
      if (!repositoryFile) {
        setError("Please select a repository ZIP file.");
        return;
      }

      if (!repositoryFile.name.toLowerCase().endsWith(".zip")) {
        setError("Please select a valid ZIP archive.");
        return;
      }

      if (
        repositoryFile.size === 0 ||
        repositoryFile.size > MAX_REPOSITORY_SIZE
      ) {
        setError(
          "The repository ZIP must be greater than 0 bytes and no larger than 25 MB."
        );
        return;
      }

      if (failure.length < 1 || failure.length > 300) {
        setError(
          "Expected failure marker must be between 1 and 300 characters."
        );
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const response =
        mode === "repository"
          ? await submitRepositoryRepair(
              repositoryFile!,
              description,
              failure
            )
          : await submitRepair(description);

      // Reset the form after the backend accepts the repair.
      setMode("demo");
      setBugReport("");
      setExpectedFailure("");
      setRepositoryFile(null);
      setError(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setSubmitting(false);

      // Navigate to the dedicated repair session.
      router.push(
        `/repairs/${encodeURIComponent(response.job_id)}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit the repair request."
      );

      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <RepairForm
        mode={mode}
        onModeChange={handleModeChange}
        bugReport={bugReport}
        onBugReportChange={setBugReport}
        expectedFailure={expectedFailure}
        onExpectedFailureChange={setExpectedFailure}
        repositoryFile={repositoryFile}
        onRepositoryChange={handleRepositoryChange}
        fileInputRef={fileInputRef}
        submitting={submitting}
        active={false}
        onSubmit={handleSubmit}
      />

      {error && (
        <div className="api-error" role="alert">
          <strong>Something went wrong</strong>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}