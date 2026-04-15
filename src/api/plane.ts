import type {
  PlaneWorkspace,
  PlaneProject,
  PlaneState,
  PlaneIssue,
  PlaneMember,
  PlaneCycle,
} from "../types/plane";

const BASE_URL = import.meta.env.DEV
  ? "/plane-api"
  : import.meta.env.VITE_PLANE_API_BASE_URL ?? "https://api.plane.so";

function getApiKey(): string {
  return import.meta.env.VITE_PLANE_API_KEY ?? "";
}

function parseListResponse<T>(data: unknown, path: string): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (
    typeof data === "object" &&
    data !== null &&
    "results" in data &&
    Array.isArray((data as { results?: unknown }).results)
  ) {
    return (data as { results: T[] }).results;
  }

  throw new Error(`Plane API returned an unexpected list payload for ${path}`);
}

async function planeFetch<T>(path: string): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("VITE_PLANE_API_KEY is not set");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Plane API error ${res.status}: ${res.statusText} (${path})`);
  }

  return res.json() as Promise<T>;
}

export async function fetchWorkspaces(): Promise<PlaneWorkspace[]> {
  const path = "/api/v1/workspaces/";
  const data = await planeFetch<unknown>(path);
  return parseListResponse<PlaneWorkspace>(data, path);
}

export async function fetchProjects(workspaceSlug: string): Promise<PlaneProject[]> {
  const path = `/api/v1/workspaces/${workspaceSlug}/projects/`;
  const data = await planeFetch<unknown>(path);
  return parseListResponse<PlaneProject>(data, path);
}

export async function fetchStates(
  workspaceSlug: string,
  projectId: string
): Promise<PlaneState[]> {
  const path = `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/states/`;
  const data = await planeFetch<unknown>(path);
  return parseListResponse<PlaneState>(data, path);
}

export async function fetchIssues(
  workspaceSlug: string,
  projectId: string
): Promise<PlaneIssue[]> {
  const path = `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/issues/?expand=state_detail,assignee_details,label_details`;
  const data = await planeFetch<unknown>(path);
  return parseListResponse<PlaneIssue>(data, path);
}

export async function fetchCurrentUser(
  workspaceSlug: string
): Promise<PlaneMember> {
  return planeFetch<PlaneMember>(
    `/api/v1/workspaces/${workspaceSlug}/members/me/`
  );
}

export async function fetchActiveCycles(
  workspaceSlug: string,
  projectId: string
): Promise<PlaneCycle[]> {
  const path = `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/?cycle_view=current`;
  const data = await planeFetch<unknown>(path);
  return parseListResponse<PlaneCycle>(data, path);
}

export async function fetchCycleIssues(
  workspaceSlug: string,
  projectId: string,
  cycleId: string
): Promise<PlaneIssue[]> {
  const path = `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/cycle-issues/?expand=state_detail,assignee_details,label_details`;
  const data = await planeFetch<unknown>(path);
  return parseListResponse<PlaneIssue>(data, path);
}
