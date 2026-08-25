import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-[230px] flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar />
        <main className={cn("min-w-0 flex-1", padded && "px-[26px] py-[22px]", className)}>{children}</main>
      </div>
    </div>
  );
}
