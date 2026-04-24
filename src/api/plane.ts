import type {
  PlaneProject,
  PlaneState,
  PlaneIssue,
  PlaneMember,
  PlaneLabel,
  PlaneCycle,
} from "../types/plane";

const BASE_URL = "/plane-api";

type RuntimeProvider = "none" | "plane" | "weather";
type WeatherCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface RuntimeConfig {
  selectedProvider: RuntimeProvider;
  monitorIndex: number;
  plane: {
    apiKey: string;
    workspaceSlug: string;
    projectId: string;
  };
  weather: {
    city: string;
    corner: WeatherCorner;
    backgroundImageUrl: string;
  };
}

let runtimeConfigPromise: Promise<RuntimeConfig> | null = null;

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (runtimeConfigPromise) {
    return runtimeConfigPromise;
  }

  runtimeConfigPromise = (async () => {
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname.toLowerCase();

    if (!params.has("provider")) {
      if (pathname.startsWith("/weather")) {
        params.set("provider", "weather");
      } else if (pathname.startsWith("/plane")) {
        params.set("provider", "plane");
      }
    }

    const query = params.toString();
    const runtimeConfigUrl = query ? `/api/runtime-config?${query}` : "/api/runtime-config";

    const res = await fetch(runtimeConfigUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("runtime config is not available");
    }

    const data = (await res.json()) as RuntimeConfig;
    if (!data.selectedProvider || !data.plane || !data.weather) {
      throw new Error("runtime config is incomplete");
    }
    return data;
  })();

  return runtimeConfigPromise;
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
  const cfg = await getRuntimeConfig();
  const apiKey = cfg.plane.apiKey;
  if (!apiKey) {
    throw new Error("Plane API key is not configured");
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

export async function fetchWorkspaceMembers(
  workspaceSlug: string
): Promise<PlaneMember[]> {
  const path = `/api/v1/workspaces/${workspaceSlug}/members/`;
  const data = await planeFetch<unknown>(path);
  return parseListResponse<PlaneMember>(data, path);
}

export async function fetchProjectLabels(
  workspaceSlug: string,
  projectId: string
): Promise<PlaneLabel[]> {
  const path = `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/labels/`;
  const data = await planeFetch<unknown>(path);
  return parseListResponse<PlaneLabel>(data, path);
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
