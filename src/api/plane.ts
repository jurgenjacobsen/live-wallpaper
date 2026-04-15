import type {
  PlaneWorkspace,
  PlaneProject,
  PlaneState,
  PlaneIssue,
  PlaneMember,
  PlaneCycle,
  PaginatedResponse,
} from "../types/plane";

const BASE_URL = "https://api.plane.so";

function getApiKey(): string {
  return import.meta.env.VITE_PLANE_API_KEY ?? "";
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
  const data = await planeFetch<PaginatedResponse<PlaneWorkspace>>(
    "/api/v1/workspaces/"
  );
  return data.results;
}

export async function fetchProjects(workspaceSlug: string): Promise<PlaneProject[]> {
  const data = await planeFetch<PaginatedResponse<PlaneProject>>(
    `/api/v1/workspaces/${workspaceSlug}/projects/`
  );
  return data.results;
}

export async function fetchStates(
  workspaceSlug: string,
  projectId: string
): Promise<PlaneState[]> {
  const data = await planeFetch<PaginatedResponse<PlaneState>>(
    `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/states/`
  );
  return data.results;
}

export async function fetchIssues(
  workspaceSlug: string,
  projectId: string
): Promise<PlaneIssue[]> {
  const data = await planeFetch<PaginatedResponse<PlaneIssue>>(
    `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/issues/?expand=state_detail,assignee_details,label_details`
  );
  return data.results;
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
  const data = await planeFetch<PaginatedResponse<PlaneCycle>>(
    `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/?cycle_view=current`
  );
  return data.results;
}

export async function fetchCycleIssues(
  workspaceSlug: string,
  projectId: string,
  cycleId: string
): Promise<PlaneIssue[]> {
  const data = await planeFetch<PaginatedResponse<PlaneIssue>>(
    `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/cycles/${cycleId}/cycle-issues/?expand=state_detail,assignee_details,label_details`
  );
  return data.results;
}
