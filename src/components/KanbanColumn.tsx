import type { PlaneIssue, PlaneState } from "../types/plane";
import { IssueCard } from "./IssueCard";

interface KanbanColumnProps {
  title: string;
  issues: PlaneIssue[];
  accentColor: string;
  states: PlaneState[];
  columnGroup: "todo" | "inProgress" | "done";
}

const GROUP_ICONS: Record<string, string> = {
  todo: "○",
  inProgress: "◑",
  done: "●",
};

export function KanbanColumn({
  title,
  issues,
  accentColor,
  columnGroup,
}: KanbanColumnProps) {
  const icon = GROUP_ICONS[columnGroup] ?? "○";

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--plane-surface)",
        border: "1px solid var(--plane-border)",
        flex: "1 1 0",
        minWidth: 0,
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          borderBottom: "1px solid var(--plane-border)",
          backgroundColor: "var(--plane-surface)",
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: accentColor, fontSize: "16px" }}>{icon}</span>
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: "var(--plane-text)" }}
          >
            {title}
          </span>
        </div>
        <span
          className="text-xs font-medium rounded-full px-2 py-0.5"
          style={{
            backgroundColor: `${accentColor}1a`,
            color: accentColor,
            border: `1px solid ${accentColor}33`,
          }}
        >
          {issues.length}
        </span>
      </div>

      {/* Issues list */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{ scrollbarWidth: "thin" }}
      >
        {issues.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-24 rounded-lg"
            style={{
              border: "1px dashed var(--plane-border)",
              color: "var(--plane-text-muted)",
            }}
          >
            <span className="text-lg mb-1">✓</span>
            <span className="text-xs">No work items</span>
          </div>
        ) : (
          issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))
        )}
      </div>
    </div>
  );
}
