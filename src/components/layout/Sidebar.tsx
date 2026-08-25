import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  LayoutDashboard,
  LibraryBig,
  Link2,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/compiler", label: "AI Compiler", icon: Sparkles },
  { to: "/studio", label: "Workflow Studio", icon: Workflow },
  { to: "/verification", label: "Verification", icon: ShieldCheck },
  { to: "/executions", label: "Executions", icon: Activity },
  { to: "/library", label: "Workflow Library", icon: LibraryBig },
  { to: "/integrations", label: "Integrations", icon: Link2 },
  { to: "/policies", label: "Policies", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="phase2-sidebar fixed inset-y-0 left-0 z-50 flex w-[230px] flex-col px-[15px] pb-[18px] pt-[25px] text-white">
      <div className="mb-7 flex items-start gap-3 px-2.5">
        <Link to="/compiler" className="contents">
          <span className="phase2-brand-icon grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[9px]">
            <Workflow className="h-[22px] w-[22px]" />
          </span>
          <span className="min-w-0 leading-tight">
            <strong className="block text-[20px] font-semibold">FlowForge AI</strong>
            <span className="mt-1 block text-[11px] leading-[1.45] text-[#d3e2e9]">
              Natural Language to<br />Verified Workflow
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex flex-col gap-[5px]">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex h-[47px] items-center gap-[14px] rounded-lg px-[14px] text-[14px] text-[#f4f8fa] transition",
                "hover:bg-white/[0.07]",
                active && "phase2-nav-active",
              )}
            >
              <Icon className="h-[19px] w-[19px]" />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/[0.12] px-2 pt-[18px]">
        <a href="#" className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2 text-[12px] text-[#d8e5eb] transition hover:bg-white/[0.07]">
          <BookOpen className="h-4 w-4" /> Documentation
        </a>
        <div className="flex items-center gap-[10px]">
          <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#e8f6f6] text-[12px] font-extrabold text-[#2b6371]">FF</span>
          <span>
            <b className="block text-[12px]">Local Workspace</b>
            <span className="mt-[3px] block text-[10px] text-[#c6d8e0]">Developer Mode</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
