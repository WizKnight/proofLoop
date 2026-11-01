
"use client";

import Link from "next/link";

import WorkspaceDashboard from "@/components/workspace/WorkspaceDashboard";

function LogoMark() {
  return (
    <div className="brand-mark" aria-label="ProofLoop logo">
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M7 7.5L12 4L17 7.5V13"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 16.5L12 20L7 16.5V11"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 12L11.3 13.8L15 10.2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <LogoMark />
        <span className="brand-name">ProofLoop</span>
        <span className="brand-version">BETA</span>
      </Link>

      <div className="sidebar-section">
        <div className="sidebar-label">Workspace</div>

        <nav className="nav-list" aria-label="Main navigation">
          <Link href="/" className="nav-item active" aria-current="page">
            <span className="nav-icon">⌂</span>
            Overview
          </Link>

          <span className="nav-item" aria-disabled="true">
            <span className="nav-icon">◷</span>
            Repair history
          </span>

          <span className="nav-item" aria-disabled="true">
            <span className="nav-icon">⌘</span>
            Evidence
          </span>
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-divider" />

        <nav className="nav-list" aria-label="Preferences">
          <span className="nav-item" aria-disabled="true">
            <span className="nav-icon">⚙</span>
            Settings
          </span>
          <span className="nav-item" aria-disabled="true">
            <span className="nav-icon">?</span>
            Documentation
          </span>
        </nav>

        <div className="sidebar-divider" />

        <div className="profile">
          <div className="avatar">PL</div>
          <div>
            <div className="profile-name">Developer workspace</div>
            <div className="profile-caption">Personal workspace</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <header className="topbar">
      <div className="mobile-brand">
        <LogoMark />
        ProofLoop
      </div>

      <div className="breadcrumb">
        Workspace <span aria-hidden="true">/</span>{" "}
        <strong>Overview</strong>
      </div>

      <div className="topbar-right">
        <div className="connection-status">
          <span className="status-dot" />
          API integration pending
        </div>
        <div className="topbar-avatar">PL</div>
      </div>
    </header>
  );
}


function ProcessStrip() {
  const steps = [
    {
      number: "01",
      title: "Reproduce",
      description: "Establish the baseline failure",
    },
    {
      number: "02",
      title: "Generate patch",
      description: "Propose a constrained code change",
    },
    {
      number: "03",
      title: "Verify",
      description: "Execute regression tests",
    },
  ];

  return (
    <section className="process-strip" aria-label="Repair workflow">
      {steps.map((step) => (
        <div className="process-item" key={step.number}>
          <span className="process-number">{step.number}</span>
          <div>
            <div className="process-title">{step.title}</div>
            <div className="process-description">{step.description}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

export default function Home() {

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-area">
        <Topbar />

        <div className="workspace">
          <div className="eyebrow">
            <span className="eyebrow-mark" />
            Evidence-first code repair
          </div>

          <div className="page-heading">
            <h1>What should we fix today?</h1>
            <p>
              Describe a bug. ProofLoop will investigate the failure,
              propose a patch, and verify the result through real execution
              evidence.
            </p>
          </div>

          <WorkspaceDashboard />

          <ProcessStrip />

          <footer className="footer">
            <div className="footer-brand">
              <LogoMark />
              <span>ProofLoop</span>
            </div>
            <span>AI-generated patches. Execution-backed verification.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
