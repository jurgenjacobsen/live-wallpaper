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
        <PriorityBadge priority={issue.priority} />
      </div>

      {/* Title */}
      <p
        className="text-[12px] font-medium leading-snug line-clamp-2"
        style={{ color: "var(--plane-text)" }}
      >
        {issue.name}
      </p>

      {/* Footer: labels + date + assignees */}
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {issue.label_details?.slice(0, 2).map((label) => (
            <span
              key={label.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${label.color}1a`,
                border: `1px solid ${label.color}33`,
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
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

          {/* Assignee avatars */}
          <div className="flex -space-x-1">
            {issue.assignee_details?.slice(0, 3).map((member) => (
              member.avatar ? (
                <img
                  key={member.id}
                  src={member.avatar}
                  alt={member.display_name}
                  title={member.display_name}
                  className="w-5 h-5 rounded-full border"
                  style={{ borderColor: "var(--plane-bg)" }}
                />
              ) : (
                <div
                  key={member.id}
                  title={member.display_name}
                  className="w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold"
                  style={{
                    borderColor: "var(--plane-bg)",
                    backgroundColor: "var(--plane-accent)",
                    color: "#fff",
                  }}
                >
                  {member.display_name.charAt(0).toUpperCase()}
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
