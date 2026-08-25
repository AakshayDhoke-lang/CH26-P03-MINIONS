import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/lib/types";

const styles: Record<string, string> = {
  VERIFIED: "bg-success/12 text-success border-success/30",
  DRAFT: "bg-muted text-muted-foreground border-border",
  "ISSUES FOUND": "bg-warning/12 text-warning border-warning/30",
  "NEEDS USER INPUT": "bg-warning/12 text-warning border-warning/30",
  RUNNING: "bg-primary/12 text-primary border-primary/30",
  Completed: "bg-success/12 text-success border-success/30",
  Failed: "bg-danger/12 text-danger border-danger/30",
  Running: "bg-primary/12 text-primary border-primary/30",
  "Awaiting approval": "bg-warning/12 text-warning border-warning/30",
};

export function StatusBadge({
  status,
  className,
}: {
  status: WorkflowStatus | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
        styles[status] ?? styles.DRAFT,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
