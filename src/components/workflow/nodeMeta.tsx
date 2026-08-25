import {
  Bell,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  GitMerge,
  Play,
  Split,
  Square,
  UserCheck,
  Webhook,
  Zap,
} from "lucide-react";
import type { NodeKind } from "@/lib/types";

export const NODE_META: Record<
  NodeKind,
  { label: string; icon: typeof Zap; color: string; tint: string }
> = {
  trigger: { label: "Trigger", icon: Zap, color: "text-primary", tint: "bg-primary/12 border-primary/30" },
  action: { label: "Action", icon: Play, color: "text-info", tint: "bg-info/12 border-info/30" },
  condition: { label: "Condition", icon: Split, color: "text-warning", tint: "bg-warning/12 border-warning/30" },
  approval: { label: "Approval", icon: UserCheck, color: "text-ai", tint: "bg-ai/12 border-ai/30" },
  api: { label: "HTTP / API", icon: Globe, color: "text-primary", tint: "bg-primary/12 border-primary/30" },
  webhook: { label: "Webhook", icon: Webhook, color: "text-ai", tint: "bg-ai/12 border-ai/30" },
  database: { label: "Database", icon: Database, color: "text-info", tint: "bg-info/12 border-info/30" },
  notification: { label: "Notification", icon: Bell, color: "text-success", tint: "bg-success/12 border-success/30" },
  delay: { label: "Delay", icon: Clock, color: "text-muted-foreground", tint: "bg-muted border-border" },
  join: { label: "Join", icon: GitMerge, color: "text-ai", tint: "bg-ai/12 border-ai/30" },
  end: { label: "End", icon: Square, color: "text-muted-foreground", tint: "bg-muted border-border" },
};

export const STATUS_META = {
  idle: { label: "Waiting", cls: "text-muted-foreground bg-muted" },
  waiting: { label: "Waiting", cls: "text-muted-foreground bg-muted" },
  running: { label: "Running", cls: "text-primary bg-primary/15" },
  completed: { label: "Completed", cls: "text-success bg-success/15" },
  failed: { label: "Failed", cls: "text-danger bg-danger/15" },
  paused: { label: "Awaiting human", cls: "text-warning bg-warning/15" },
} as const;

export const CheckIcon = CheckCircle2;
