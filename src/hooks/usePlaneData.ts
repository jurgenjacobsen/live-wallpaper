import { useState, useEffect, useCallback } from "react";
import type {
  GroupedIssues,
  PlaneIssue,
  PlaneLabel,
  PlaneMember,
  PlaneProject,
  PlaneState,
} from "../types/plane";
import {
  fetchProjects,
  fetchProjectLabels,
  fetchStates,
  fetchIssues,
  fetchCurrentUser,
  fetchWorkspaceMembers,
  fetchActiveCycles,
  fetchCycleIssues,
  getRuntimeConfig,
} from "../api/plane";

interface UsePlaneDataReturn {
  groupedIssues: GroupedIssues;
  projectName: string;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

function previewList(values: string[]): string {
  const unique = Array.from(new Set(values.filter(Boolean)));
  const preview = unique.slice(0, 8);
  return preview.join(", ") + (unique.length > preview.length ? ", ..." : "");
}

async function resolveProject(
  workspaceSlug: string,
  inputProject: string
): Promise<Pick<PlaneProject, "id" | "name">> {
  const projects = await fetchProjects(workspaceSlug);
  const normalized = inputProject.trim().toLowerCase();

  const match = projects.find((p) => {
    const byId = p.id.toLowerCase() === normalized;
    const byIdentifier = p.identifier.toLowerCase() === normalized;
    const byName = p.name.toLowerCase() === normalized;
    return byId || byIdentifier || byName;
  });

  if (!match) {
    throw new Error(
      `Project "${inputProject}" not found in workspace "${workspaceSlug}". Available project identifiers: ${previewList(
        projects.map((p) => p.identifier)
      )}`
    );
  }

  return {
    id: match.id,
    name: match.name,
  };
}

function groupIssuesByState(
  issues: PlaneIssue[],
  states: PlaneState[]
): GroupedIssues {
  const stateMap = new Map<string, PlaneState>();
  for (const s of states) {
    stateMap.set(s.id, s);
  }

  const todo: PlaneIssue[] = [];
  const inProgress: PlaneIssue[] = [];
  const done: PlaneIssue[] = [];

  for (const issue of issues) {
    const state = issue.state_detail ?? stateMap.get(issue.state);
    const group = state?.group ?? "unstarted";

    if (group === "started") {
      inProgress.push(issue);
    } else if (group === "completed") {
      done.push(issue);
    } else {
      // backlog, unstarted, cancelled → Todo
      todo.push(issue);
    }
  }

  return { todo, inProgress, done };
}

function looksLikeHashOrId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return true;
  if (/^[0-9a-f-]{8,}$/i.test(trimmed)) return true;
  return false;
}

function enrichIssueDetails(
  issues: PlaneIssue[],
  members: PlaneMember[],
  labels: PlaneLabel[]
): PlaneIssue[] {
  const memberById = new Map(members.map((m) => [m.id, m]));
  const labelById = new Map(labels.map((l) => [l.id, l]));

  return issues.map((issue) => {
    const source = issue as PlaneIssue & {
      labels?: Array<{ id?: string; name?: string; color?: string } | string>;
    };

    const hasReadableLabelDetails =
      Array.isArray(issue.label_details) &&
      issue.label_details.some(
        (label) =>
          typeof label?.name === "string" &&
          label.name.trim() !== "" &&
          !looksLikeHashOrId(label.name)
      );

    const resolvedLabelDetails = hasReadableLabelDetails
      ? issue.label_details
      : (source.labels ?? [])
          .map((entry) => {
            if (typeof entry === "string") {
              return labelById.get(entry) ?? null;
            }

            if (entry && typeof entry === "object") {
              if (entry.id && labelById.has(entry.id)) {
                return labelById.get(entry.id) ?? null;
              }

              if (entry.name && !looksLikeHashOrId(entry.name)) {
                return {
                  id: entry.id ?? entry.name,
                  name: entry.name,
                  color: entry.color ?? "#6b7280",
                } as PlaneLabel;
              }
            }

            return null;
          })
          .filter((label): label is PlaneLabel => label !== null);

    const resolvedAssigneeDetails =
      Array.isArray(issue.assignee_details) && issue.assignee_details.length > 0
        ? issue.assignee_details
        : issue.assignees
            .map((assigneeId) => memberById.get(assigneeId) ?? null)
            .filter((member): member is PlaneMember => member !== null);

    return {
      ...issue,
      label_details: resolvedLabelDetails,
      assignee_details: resolvedAssigneeDetails,
    };
  });
}

export function usePlaneData(): UsePlaneDataReturn {
  const [groupedIssues, setGroupedIssues] = useState<GroupedIssues>({
    todo: [],
    inProgress: [],
    done: [],
  });
  const [projectName, setProjectName] = useState("Project");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const runtimeConfig = await getRuntimeConfig();
        const workspaceSlug = runtimeConfig.plane.workspaceSlug;
        const projectId = runtimeConfig.plane.projectId;

        const resolvedProject = await resolveProject(
          workspaceSlug,
          projectId
        );

        if (!cancelled) {
          setProjectName(resolvedProject.name || "Project");
        }

        const [fetchedStates, currentUser, activeCycles, members, labels] = await Promise.all([
          fetchStates(workspaceSlug, resolvedProject.id),
          fetchCurrentUser(workspaceSlug).catch(() => null),
          fetchActiveCycles(workspaceSlug, resolvedProject.id).catch(() => []),
          fetchWorkspaceMembers(workspaceSlug).catch(() => []),
          fetchProjectLabels(workspaceSlug, resolvedProject.id).catch(() => []),
        ]);

        if (cancelled) return;

        let issues: PlaneIssue[];

        const activeCycle = activeCycles.find((c) => c.status === "current");

        if (activeCycle) {
          // Prefer cycle issues when there is an active cycle
          issues = await fetchCycleIssues(
            workspaceSlug,
            resolvedProject.id,
            activeCycle.id
          );
        } else {
          issues = await fetchIssues(workspaceSlug, resolvedProject.id);
        }

        if (cancelled) return;

        const enrichedIssues = enrichIssueDetails(issues, members, labels);

        // Filter to current user's assignments when user info is available
        const filteredIssues =
          currentUser
            ? enrichedIssues.filter((i) => i.assignees.includes(currentUser.id))
            : enrichedIssues;

        setGroupedIssues(groupIssuesByState(filteredIssues, fetchedStates));
        setLastUpdated(new Date());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    groupedIssues,
    projectName,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}
