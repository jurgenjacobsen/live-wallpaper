export interface PlaneWorkspace {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
}

export interface PlaneProject {
  id: string;
  identifier: string;
  name: string;
  description: string;
  emoji: string | null;
  icon_prop: string | null;
  network: number;
  is_member: boolean;
}

export interface PlaneState {
  id: string;
  name: string;
  color: string;
  group: "backlog" | "unstarted" | "started" | "completed" | "cancelled";
  sequence: number;
  project: string;
}

export interface PlaneMember {
  id: string;
  display_name: string;
  email: string;
  avatar: string | null;
  first_name: string;
  last_name: string;
  role: number;
}

export type PriorityLevel = "urgent" | "high" | "medium" | "low" | "none";

export interface PlaneIssue {
  id: string;
  sequence_id: number;
  name: string;
  description_html: string | null;
  priority: PriorityLevel;
  state: string;
  state_detail: PlaneState;
  assignees: string[];
  assignee_details: PlaneMember[];
  label_details: PlaneLabel[];
  created_at: string;
  updated_at: string;
  target_date: string | null;
  completed_at: string | null;
  project: string;
  workspace: string;
  estimate_point: number | null;
  cycle_id: string | null;
}

export interface PlaneLabel {
  id: string;
  name: string;
  color: string;
}

export interface PlaneCycle {
  id: string;
  name: string;
  status: "current" | "upcoming" | "completed" | "draft";
  start_date: string | null;
  end_date: string | null;
  project: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Issues grouped for the Kanban board */
export interface GroupedIssues {
  todo: PlaneIssue[];
  inProgress: PlaneIssue[];
  done: PlaneIssue[];
}
