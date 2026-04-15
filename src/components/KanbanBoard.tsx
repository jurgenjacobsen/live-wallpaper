import { usePlaneData } from "../hooks/usePlaneData";
import { KanbanColumn } from "./KanbanColumn";

const COLUMN_CONFIG = [
  {
    key: "todo" as const,
    title: "Todo",
    accentColor: "#8f91a2",
  },
  {
    key: "inProgress" as const,
    title: "In Progress",
    accentColor: "#f97316",
  },
  {
    key: "done" as const,
    title: "Done",
    accentColor: "#22c55e",
  },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toTitleFromEnv(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Project";

  const normalized = trimmed
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ");

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full" style={{ color: "var(--plane-text-muted)" }}>
      <div className="text-center">
        <div className="text-4xl mb-4 animate-spin">⟳</div>
        <p className="text-sm">Loading from Plane.so…</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full" style={{ color: "var(--plane-text-muted)" }}>
      <div
        className="max-w-md text-center rounded-xl p-6"
        style={{
          backgroundColor: "var(--plane-surface)",
          border: "1px solid #ef444433",
        }}
      >
        <div className="text-3xl mb-3">⚠</div>
        <p className="text-sm font-medium mb-2" style={{ color: "#ef4444" }}>
          Failed to load data
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--plane-text-muted)" }}>
          {message}
        </p>
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const { groupedIssues, states, loading, error, lastUpdated } = usePlaneData();

  const projectName = toTitleFromEnv(import.meta.env.VITE_PROJECT_ID ?? "");

  const totalIssues =
    groupedIssues.todo.length +
    groupedIssues.inProgress.length +
    groupedIssues.done.length;

  return (
    <div
      className="flex flex-col"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "var(--plane-bg)",
        padding: "20px 24px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between mb-4 shrink-0"
        style={{
          borderBottom: "1px solid var(--plane-border)",
          paddingBottom: "12px",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: "var(--plane-accent)",
              color: "#fff",
            }}
          >
            {projectName.charAt(0)}
          </div>
          <div>
            <h1
              className="text-sm font-semibold leading-none"
              style={{ color: "var(--plane-text)" }}
            >
              {projectName}
            </h1>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--plane-text-muted)" }}
            >
              {totalIssues} work items
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs" style={{ color: "var(--plane-text-muted)" }}>
              Updated {formatTime(lastUpdated)}
            </span>
          )}
          <div
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              backgroundColor: "var(--plane-surface)",
              border: "1px solid var(--plane-border)",
              color: "var(--plane-text-secondary)",
            }}
          >
            Kanban
          </div>
        </div>
      </div>

      {/* Board content */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div
          className="flex gap-4"
          style={{ flex: "1 1 0", minHeight: 0 }}
        >
          {COLUMN_CONFIG.map((col) => (
            <KanbanColumn
              key={col.key}
              title={col.title}
              issues={groupedIssues[col.key]}
              accentColor={col.accentColor}
              states={states}
              columnGroup={col.key}
            />
          ))}
        </div>
      )}
    </div>
  );
}
