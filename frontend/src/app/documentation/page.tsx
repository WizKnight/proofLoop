import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  FileCode2,
  FileText,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Workflow,
} from "lucide-react";

import AppShell from "@/components/layout/AppShell";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "workflow", label: "Repair workflow" },
  { id: "verification", label: "Verification" },
  { id: "evidence", label: "Execution evidence" },
  { id: "sandbox", label: "Sandbox execution" },
  { id: "limitations", label: "Limitations" },
];

const workflow = [
  {
    number: "01",
    title: "Report the bug",
    description:
      "Describe the issue and provide the relevant context. You can use the built-in demo fixture or upload a Python repository.",
    icon: Search,
  },
  {
    number: "02",
    title: "Reproduce the failure",
    description:
      "ProofLoop executes the baseline tests to establish whether the reported failure can be reproduced.",
    icon: Terminal,
  },
  {
    number: "03",
    title: "Generate and apply a patch",
    description:
      "The repair agent analyzes the issue, proposes a code change, and applies the generated patch to the working repository.",
    icon: FileCode2,
  },
  {
    number: "04",
    title: "Run regression tests",
    description:
      "The patched code is tested again. Execution results are recorded as evidence for the final verification decision.",
    icon: CheckCircle2,
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0180fa]">
        {eyebrow}
      </p>
      <h2 className="text-lg font-semibold tracking-tight text-[#292724]">
        {title}
      </h2>
      <p className="max-w-2xl text-xs leading-relaxed text-[#817B73]">
        {description}
      </p>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#EAE7E2] bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-[#F5F3F0] text-[#7165C5]">
          <Icon className="size-4" />
        </div>
        <h3 className="text-xs font-semibold text-[#34312D]">{title}</h3>
      </div>
      <div className="mt-3 text-xs leading-relaxed text-[#777168]">
        {children}
      </div>
    </div>
  );
}

export default function DocumentationPage() {
  return (
    <AppShell
      title="Documentation"
      description="Learn how ProofLoop investigates, repairs, and verifies bugs"
    >
      <div className="mx-auto w-full max-w-5xl space-y-9 pb-12 mt-6">
        {/* Introduction */}
        <header className="space-y-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-orange-400 text-black">
            <BookOpen className="size-5" />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0180fa]">
              PROOFLOOP GUIDE
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#292724] sm:text-3xl">
              Documentation
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#817B73]">
              Understand how ProofLoop investigates software bugs, applies
              patches, executes tests, and records evidence to support its
              verification results.
            </p>
          </div>
        </header>

        {/* Quick navigation */}
        <nav
          aria-label="Documentation sections"
          className="flex flex-wrap gap-2"
        >
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-[#EAE7E2] bg-white px-3 py-2 text-[11px] font-medium text-[#66615A] transition-colors hover:border-black/35 hover:bg-orange-100 hover:text-[#7163C7]"
            >
              {section.label}
            </a>
          ))}
        </nav>

        {/* Overview */}
        <section id="overview" className="scroll-mt-8 space-y-4">
          <SectionHeading
            eyebrow="01 · Introduction"
            title="What is ProofLoop?"
            description="An AI-powered bug repair workflow that connects proposed code changes to actual execution results."
          />

          <div className="rounded-2xl border border-[#EAE7E2] bg-white p-5 sm:p-6">
            <p className="text-sm leading-7 text-[#57534E]">
              ProofLoop investigates reported Python bugs, generates and
              applies patches, and executes tests to evaluate whether the
              proposed change resolves the reported issue.
            </p>

            <p className="mt-3 text-sm leading-7 text-[#57534E]">
              It's central principle is evidence-backed verification: a
              proposed fix should not be presented as verified unless the
              recorded execution evidence supports that result.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {["Bug investigation", "Patch generation", "Test execution", "Evidence-backed verification"].map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-blue-100 px-3 py-1.5 text-[10px] font-medium text-[#66615A]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="scroll-mt-8 space-y-4">
          <SectionHeading
            eyebrow="02 · Process"
            title="The repair workflow"
            description="Each repair moves through a sequence of investigation, modification, and execution stages."
          />

          <div className="space-y-3">
            {workflow.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.number}
                  className="flex gap-4 rounded-xl border border-[#EAE7E2] bg-white p-4 sm:p-5"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F5F3F0] text-[#7165C5]">
                    <Icon className="size-[18px]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-semibold text-[#0180fa]">
                        {step.number}
                      </span>
                      <h3 className="text-sm font-semibold text-[#34312D]">
                        {step.title}
                      </h3>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-[#777168]">
                      {step.description}
                    </p>
                  </div>

                </div>
              );
            })}
          </div>

          <div className="rounded-xl bg-[#F8F6FF] p-4">
            <p className="text-xs font-semibold text-[#7163C7]">
              Two ways to start
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#7163C7]">
              Use the built-in demo fixture to explore the workflow, or
              upload a Python repository with a bug description and expected
              failure information.
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6658B8] hover:underline"
            >
              Start a repair
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>

        {/* Verification */}
        <section id="verification" className="scroll-mt-8 space-y-4">
          <SectionHeading
            eyebrow="03 · Trust"
            title="How verification works"
            description="Verification is based on observed execution results, not simply on whether a patch was generated."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard icon={ShieldCheck} title="Verified">
              The expected baseline failure was reproduced, the source was
              changed, and the supplied regression tests passed after the
              patch.
            </InfoCard>

            <InfoCard icon={ShieldAlert} title="Unverified">
              The available execution evidence does not establish that the
              repair satisfies the verification requirements.
            </InfoCard>
          </div>

          <div className="rounded-xl border border-[#EAE7E2] bg-white p-4">
            <h3 className="text-xs font-semibold text-[#34312D]">
              Important distinction
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#777168]">
              A successful patch-generation step is not proof that a bug
              has been fixed. Likewise, passing a supplied regression suite
              does not prove that every possible bug in the repository has
              been eliminated.
            </p>
          </div>
        </section>

        {/* Evidence */}
        <section id="evidence" className="scroll-mt-8 space-y-4">
          <SectionHeading
            eyebrow="04 · Traceability"
            title="Understanding execution evidence"
            description="Each repair report can contain structured records describing what happened during execution."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard icon={Terminal} title="Execution details">
              Commands, executor information, exit codes, timeout status,
              standard output, and standard error where recorded.
            </InfoCard>

            <InfoCard icon={FileCode2} title="Patch information">
              Changed files, patch diffs, and source-integrity hashes where
              available.
            </InfoCard>

            <InfoCard icon={CheckCircle2} title="Test outcomes">
              Baseline failure reproduction and post-patch regression
              results.
            </InfoCard>

            <InfoCard icon={FileText} title="Report metadata">
              Repair summary, verification status, timestamp, and
              verification scope.
            </InfoCard>
          </div>

          <Link
            href="/evidence"
            className="inline-flex items-center gap-2 rounded-xl border border-[#EAE7E2] bg-white px-4 py-2.5 text-xs font-semibold text-[#57534E] transition-colors hover:bg-[#FAF9F7]"
          >
            Explore execution evidence
            <ArrowRight className="size-3.5" />
          </Link>
        </section>

        {/* Sandbox */}
        <section id="sandbox" className="scroll-mt-8 space-y-4">
          <SectionHeading
            eyebrow="05 · Execution environment"
            title="Sandbox execution"
            description="Repository repair commands are executed in an isolated Docker environment."
          />

          <div className="rounded-2xl border border-[#EAE7E2] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-[#F5F3F0] text-[#7165C5]">
                <LockKeyhole className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#34312D]">
                  Isolated execution
                </h3>
                <p className="mt-1 text-[10px] text-[#89847D]">
                  Docker-based repository execution
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-[#777168]">
              The repository repair workflow uses a Docker sandbox with
              network access disabled, a read-only filesystem configuration,
              a non-root execution user, and resource and timeout limits.
              Execution is not silently moved to the host Python environment
              if Docker is unavailable.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {["Network disabled", "Read-only filesystem", "Non-root user", "Resource limits", "Execution timeout"].map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-blue-100 px-3 py-1.5 text-[10px] font-medium text-[#66615A]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Limitations */}
        <section id="limitations" className="scroll-mt-8 space-y-4">
          <SectionHeading
            eyebrow="06 · Transparency"
            title="Current limitations"
            description="Understand what a successful repair report does—and does not—establish."
          />

          <div className="space-y-3 rounded-2xl border border-[#EAE7E2] bg-white p-5 sm:p-6">
            <ul className="space-y-3 text-xs leading-relaxed text-[#777168]">
              <li className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#0180fa]" />
                Verification is limited to the tests and execution evidence
                available to the repair workflow.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#0180fa]" />
                Passing the supplied regression tests does not guarantee
                that the repository is free of other bugs.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#0180fa]" />
                Generated patches should be reviewed before being adopted
                into a production codebase.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#0180fa]" />
                Execution evidence may be incomplete when a job fails,
                times out, or cannot produce a valid report.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#0180fa]" />
                Repository repair currently targets Python projects.
              </li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col justify-between gap-3 border-t border-[#EAE7E2] pt-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs text-[#89847D]">
            <Code2 className="size-4" />
            ProofLoop documentation
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7163C7]"
          >
            Return to workspace
            <ArrowRight className="size-3.5" />
          </Link>
        </footer>
      </div>
    </AppShell>
  );
}
