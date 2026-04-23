import type { PlaneIssue } from "../types/plane";
import { PriorityBadge } from "./PriorityBadge";

interface IssueCardProps {
  issue: PlaneIssue;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export function IssueCard({ issue }: IssueCardProps) {
  const stateColor = issue.state_detail?.color ?? "#5c5e6e";
  const overdueTarget = isOverdue(issue.target_date);
  const firstLabel = issue.label_details?.find(
    (label) => typeof label.name === "string" && label.name.trim() !== ""
  );
  const firstAssignee = issue.assignee_details?.find(
    (member) => typeof member.display_name === "string" && member.display_name.trim() !== ""
  );

  return (
    <div
      className="rounded-lg p-3 mb-2 flex flex-col gap-2 transition-all"
      style={{
        backgroundColor: "var(--plane-surface-2)",
        border: "1px solid var(--plane-border)",
      }}
    >
      {/* Header row: state dot + issue ID */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stateColor }}
          />
          <span
            className="text-[11px] font-mono shrink-0"
            style={{ color: "var(--plane-text-muted)" }}
          >
            #{issue.sequence_id}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <PriorityBadge priority={issue.priority} />
          {firstLabel && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${firstLabel.color}1a`,
                border: `1px solid ${firstLabel.color}33`,
                color: firstLabel.color,
              }}
              title={firstLabel.name}
            >
              {firstLabel.name}
            </span>
          )}
          {firstAssignee && (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: "var(--plane-surface)",
                border: "1px solid var(--plane-border)",
                color: "var(--plane-text-secondary)",
              }}
              title={firstAssignee.display_name}
            >
              <span
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold"
                style={{
                  backgroundColor: "var(--plane-accent)",
                  color: "#fff",
                }}
              >
                {firstAssignee.display_name.charAt(0).toUpperCase()}
              </span>
              {firstAssignee.display_name}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <p
        className="text-[12px] font-medium leading-snug line-clamp-2"
        style={{ color: "var(--plane-text)" }}
      >
        {issue.name}
      </p>

      {/* Footer: due date */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        {issue.target_date && (
          <span
            className="text-[10px]"
            style={{
              color: overdueTarget ? "#ef4444" : "var(--plane-text-muted)",
            }}
          >
            {formatDate(issue.target_date)}
          </span>
        )}
      </div>
    </div>
  );
}
