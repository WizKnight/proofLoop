
import type { ReactNode } from "react";

import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";

interface AppShellProps {
  children: ReactNode;
  aside?: ReactNode;
  title?: string;
  description?: string;
}

export default function AppShell({
  children,
  aside,
  title,
  description,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#F5F3F0]">
      <AppSidebar />

      <div className="min-h-screen md:pl-[272px]">
        <AppHeader title={title} description={description} />

        <div className="mx-auto flex w-full max-w-[1600px] items-start gap-7 px-5 py-7 md:px-8 md:py-9">
          <main className="min-w-0 flex-1">
            {children}
          </main>

          {aside && (
            <aside className="hidden w-[280px] shrink-0 xl:block">
              {aside}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
