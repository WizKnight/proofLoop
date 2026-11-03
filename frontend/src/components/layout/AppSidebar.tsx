"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  Code2,
  History,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "Repair history", href: "/history", icon: History },
      { label: "Evidence", href: "/evidence", icon: ShieldCheck },
    ],
  },
  {
    label: "Preferences",
    items: [
      { label: "Settings", href: "/settings", icon: Settings2 },
      { label: "Documentation", href: "/documentation", icon: BookOpen },
    ],
  },
];

function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {navigation.map((group) => (
        <div key={group.label}>
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#858078]">
            {group.label}
          </p>

          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;

              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all",
                    active
                      ? "border border-white/80 bg-white text-[#242321] shadow-sm"
                      : "border border-transparent text-[#66615A] hover:bg-white/60 hover:text-[#292724]"
                  )}
                >
                  <Icon className="size-[17px] shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function NavLinksFallback() {
  return (
    <>
      {navigation.map((group) => (
        <div key={group.label}>
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#858078]">
            {group.label}
          </p>

          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex h-10 items-center gap-3 rounded-xl border border-transparent px-3 text-[13px] font-medium text-[#66615A] transition-all hover:bg-white/60 hover:text-[#292724]"
                >
                  <Icon className="size-[17px] shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

export default function AppSidebar() {
  return (
    <aside className="fixed inset-y-3 left-3 z-40 hidden w-[248px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#F3F0EB] text-[#292724] shadow-sm md:flex">
      {/* Brand */}
      <Link
        href="/"
        className="flex h-[68px] shrink-0 items-center gap-3 border-b border-[#DED9D1] px-5"
      >
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#252525] text-white">
          <Code2 className="size-[19px]" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[16px] font-semibold tracking-tight">
            ProofLoop
          </span>
          <span className="rounded-md border border-[#BDB8B0] px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-[#77716A]">
            BETA
          </span>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-8 overflow-y-auto px-3 py-7">
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
      </nav>

      {/* Workspace profile */}
      <div className="shrink-0 border-t border-[#DED9D1] p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-[#DED9D1] bg-white/40 p-3 text-left transition-colors hover:bg-white/80"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#292929] text-xs font-semibold text-white">
            PL
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">
              Developer workspace
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#817B73]">
              Personal workspace
            </p>
          </div>

          <ChevronDown className="size-4 shrink-0 text-[#77716A]" />
        </button>
      </div>
    </aside>
  );
}