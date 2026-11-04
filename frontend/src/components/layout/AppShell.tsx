import type { ReactNode } from "react";

import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";

interface AppShellProps {
  children: ReactNode;
  aside?: ReactNode;
  title?: string;
  description?: string;
  showHeader?: boolean;
  centered?: boolean;
}

export default function AppShell({
  children,
  aside,
  title,
  description,
  showHeader = false,
  centered = false,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-blue-50">
      <AppSidebar />

      <div className="min-h-screen md:pl-[272px]">
        {showHeader && (
          <AppHeader title={title} description={description} />
        )}

        <div
          className={`mx-auto flex w-full max-w-[1600px] items-start px-5 md:px-8 ${
            centered
              ? "justify-center py-10 md:py-14"
              : "gap-7 py-7 md:py-9"
          }`}
        >
          <main
            className={`min-w-0 ${
              centered ? "w-full max-w-[1080px]" : "flex-1"
            }`}
          >
            {children}
          </main>

          {!centered && aside && (
            <aside className="hidden w-[280px] shrink-0 xl:block">
              {aside}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
