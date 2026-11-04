"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Code2,
  LayoutDashboard,
  Plus,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import RecentActivity from "@/components/workspace/RecentActivity";

const navigation = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Evidence explorer", href: "/evidence", icon: ShieldCheck },
      { label: "Documentation", href: "/documentation", icon: BookOpen },
      { label: "Settings", href: "/settings", icon: Settings2 },
    ],
  },
];

function NavigationLinks() {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {navigation.map((group) => (
        <div key={group.label}>
          <p className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#858078]">
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
                    "flex h-10 items-center gap-3 rounded-xl border px-3 text-[13px] font-medium transition-all",
                    active
                      ? "border-white/90 bg-blue-100 text-[#242321] shadow-sm"
                      : "border-transparent text-[#66615A] hover:bg-blue-100 hover:text-[#292724]"
                  )}
                >
                  <Icon className="size-[17px] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function NavigationFallback() {
  return (
    <div className="space-y-6">
      {navigation.map((group) => (
        <div key={group.label}>
          <p className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#858078]">
            {group.label}
          </p>

          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-[#66615A] hover:bg-blue-100"
                >
                  <Icon className="size-[17px] shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentActivitySection() {
  const pathname = usePathname();

  if (pathname === "/evidence") {
    return null;
  }

  return (
    <div className="border-t border-[#DED9D1] pt-5">
      <RecentActivity />
    </div>
  );
}

export default function AppSidebar() {
  return (
    <aside className="fixed inset-y-3 left-3 z-40 hidden w-[248px] flex-col overflow-hidden rounded-2xl bg-[#feffff] text-[#292724] shadow-2xl md:flex">
      {/* Brand */}
      <Link
        href="/"
        className="flex h-[68px] shrink-0 items-center gap-3 border-b border-[#DED9D1] px-5"
      >
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#252525] text-white">
          <Code2 className="size-[19px]" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[16px] font-bold tracking-tight">
            ProofLoop
          </span>

          <span className="rounded-md border border-[#BDB8B0] bg-[#b9ff37] px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-black">
            BETA
          </span>
        </div>
      </Link>

      {/* Scrollable navigation */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-6">
          {/* New repair */}
          <Link
            href="/"
            className="group flex min-h-[54px] items-center gap-3 rounded-xl bg-[#0180fa] px-3.5 py-2.5 text-white shadow-sm transition-colors hover:bg-[#0064e0]"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/70 transition-colors group-hover:bg-white/80">
              <Plus className="size-[17px]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white">
                New repair
              </p>
              <p className="mt-0.5 text-[10px] text-white/80">
                Investigate a bug
              </p>
            </div>
          </Link>

          {/* Primary navigation */}
          <Suspense fallback={<NavigationFallback />}>
            <NavigationLinks />
          </Suspense>

          {/* Recent sessions */}
          <Suspense
            fallback={
              <div className="border-t border-[#DED9D1] pt-5 px-3 py-3 text-[11px] text-[#817B73]">
                Loading recent repairs...
              </div>
            }
          >
            <RecentActivitySection />
          </Suspense>
        </div>
      </div>

      {/* Workspace footer */}
      <div className="shrink-0 border-t border-[#DED9D1] p-3">
        <div className="flex items-center gap-3 rounded-xl border border-[#DED9D1] bg-black p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/50 text-xs font-semibold text-white">
            PL
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-white font-semibold">
              Personal workspace
            </p>
            <p className="mt-0.5 truncate text-[10px] text-white/70">
              ProofLoop environment
            </p>
          </div>

          <span
            className="size-2 shrink-0 rounded-full bg-[#b9ff37]"
            title="Local workspace"
          />
        </div>
      </div>
    </aside>
  );
}