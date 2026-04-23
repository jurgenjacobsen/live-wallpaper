import type { PriorityLevel } from "../types/plane";

interface PriorityBadgeProps {
  priority: PriorityLevel;
}

const PRIORITY_CONFIG: Record<
  PriorityLevel,
  { label: string; color: string; icon: string }
> = {
  urgent: { label: "Urgent", color: "#ef4444", icon: "🔴" },
  high:   { label: "High",   color: "#f97316", icon: "🟠" },
  medium: { label: "Medium", color: "#eab308", icon: "🟡" },
  low:    { label: "Low",    color: "#3b82f6", icon: "🔵" },
  none:   { label: "None",   color: "#4b5563", icon: "⚪" },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.none;

  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide"
      style={{
        color: cfg.color,
        backgroundColor: `${cfg.color}1a`,
        border: `1px solid ${cfg.color}33`,
      }}
    >
    <span>{cfg.icon}</span>
      {cfg.label.charAt(0).toUpperCase() + cfg.label.slice(1).toLowerCase()}
    </span>
  );
}
