import { useState, useEffect, useCallback } from "react";
import type { GroupedIssues, PlaneIssue, PlaneState } from "../types/plane";
import {
  fetchProjects,
  fetchStates,
  fetchIssues,
  fetchCurrentUser,
  fetchActiveCycles,
  fetchCycleIssues,
} from "../api/plane";

interface UsePlaneDataReturn {
  groupedIssues: GroupedIssues;
  states: PlaneState[];
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

async function resolveProjectId(
  workspaceSlug: string,
  inputProject: string
): Promise<string> {
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
      `Project \"${inputProject}\" not found in workspace \"${workspaceSlug}\". Available project identifiers: ${previewList(
        projects.map((p) => p.identifier)
      )}`
    );
  }

  return match.id;
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

export function usePlaneData(): UsePlaneDataReturn {
  const workspaceSlug = import.meta.env.VITE_WORKSPACE_SLUG ?? "";
  const projectId = import.meta.env.VITE_PROJECT_ID ?? "";

  const [groupedIssues, setGroupedIssues] = useState<GroupedIssues>({
    todo: [],
    inProgress: [],
    done: [],
  });
  const [states, setStates] = useState<PlaneState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      setError("VITE_WORKSPACE_SLUG and VITE_PROJECT_ID must be set in .env");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const resolvedProjectId = await resolveProjectId(
          workspaceSlug,
          projectId
        );

        const [fetchedStates, currentUser, activeCycles] = await Promise.all([
          fetchStates(workspaceSlug, resolvedProjectId),
          fetchCurrentUser(workspaceSlug).catch(() => null),
          fetchActiveCycles(workspaceSlug, resolvedProjectId).catch(() => []),
        ]);

        if (cancelled) return;

        setStates(fetchedStates);

        let issues: PlaneIssue[];

        const activeCycle = activeCycles.find((c) => c.status === "current");

        if (activeCycle) {
          // Prefer cycle issues when there is an active cycle
          issues = await fetchCycleIssues(
            workspaceSlug,
            resolvedProjectId,
            activeCycle.id
          );
        } else {
          issues = await fetchIssues(workspaceSlug, resolvedProjectId);
        }

        if (cancelled) return;

        // Filter to current user's assignments when user info is available
        const filteredIssues =
          currentUser
            ? issues.filter((i) => i.assignees.includes(currentUser.id))
            : issues;

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
  }, [workspaceSlug, projectId, tick]);

  return { groupedIssues, states, loading, error, lastUpdated, refresh };
}
