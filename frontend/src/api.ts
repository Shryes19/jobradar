const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Auth token helpers ────────────────────────────────────────────────────────

const TOKEN_KEY = "jobradar_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }
  return res;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function register(email: string, password: string, full_name = ""): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name }),
  });
  const data = await res.json().catch(() => ({ detail: "Registration failed." }));
  if (!res.ok) throw new Error(data.detail || "Registration failed.");
  setToken(data.token);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({ detail: "Login failed." }));
  if (!res.ok) throw new Error(data.detail || "Login failed.");
  setToken(data.token);
  return data;
}

export async function getMe(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  const res = await apiFetch("/api/auth/me");
  if (!res.ok) return null;
  return res.json();
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface Profile {
  id: number;
  full_name: string | null;
  current_job_title: string | null;
  years_of_experience: string | null;
  technical_skills: string[];
  professional_summary: string | null;
  created_at: string;
}

export async function uploadCV(file: File): Promise<Profile> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch("/api/profile/upload", { method: "POST", body: form });
  const err = await res.json().catch(() => ({ detail: "An unexpected error occurred." }));
  if (!res.ok) throw new Error(err.detail || "Upload failed.");
  return err;
}

export async function getProfile(): Promise<Profile | null> {
  const res = await apiFetch("/api/profile/me");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load profile.");
  return res.json();
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export interface Job {
  id: number;
  job_title: string | null;
  company_name: string | null;
  location: string | null;
  job_description: string | null;
  linkedin_url: string | null;
  platform: string | null;
  match_score: number | null;
  status: string | null;
  status_updated_at: string | null;
  notes: string | null;
  follow_up_date: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_note: string | null;
  created_at: string;
}

export interface ScoreResult {
  job_id: number;
  score: number | null;
  error: string | null;
}

export async function scoreJobs(jobIds: number[], skillsBlacklist: string[] = []): Promise<ScoreResult[]> {
  const res = await apiFetch("/api/jobs/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_ids: jobIds, skills_blacklist: skillsBlacklist }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Scoring failed." }));
    throw new Error(err.detail || "Scoring failed.");
  }
  return res.json();
}

export async function fetchJobs(jobTitle: string, location: string, count = 15, platform = "linkedin"): Promise<Job[]> {
  const res = await apiFetch("/api/jobs/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_title: jobTitle, location, count, platform }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch jobs." }));
    throw new Error(err.detail || "Failed to fetch jobs.");
  }
  return res.json();
}

export async function getSavedJobs(): Promise<Job[]> {
  const res = await apiFetch("/api/jobs/");
  if (!res.ok) throw new Error("Failed to load saved jobs.");
  return res.json();
}

export async function deleteJob(id: number): Promise<void> {
  await apiFetch(`/api/jobs/${id}`, { method: "DELETE" });
}

export async function updateJobStatus(id: number, status: string): Promise<Job> {
  const res = await apiFetch(`/api/jobs/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update status." }));
    throw new Error(err.detail || "Failed to update status.");
  }
  return res.json();
}

export async function generateCoverLetter(jobId: number): Promise<{ cover_letter: string; job_title: string | null; company_name: string | null }> {
  const res = await apiFetch(`/api/jobs/${jobId}/cover-letter`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to generate cover letter." }));
    throw new Error(err.detail || "Failed to generate cover letter.");
  }
  return res.json();
}

export async function updateJobNotes(id: number, notes: string): Promise<Job> {
  const res = await apiFetch(`/api/jobs/${id}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error("Failed to save notes.");
  return res.json();
}

export async function updateFollowUpDate(id: number, follow_up_date: string | null): Promise<Job> {
  const res = await apiFetch(`/api/jobs/${id}/follow-up`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ follow_up_date }),
  });
  if (!res.ok) throw new Error("Failed to save follow-up date.");
  return res.json();
}

export async function getTrackerJobs(): Promise<Job[]> {
  const res = await apiFetch("/api/jobs/tracker");
  if (!res.ok) throw new Error("Failed to load tracker jobs.");
  return res.json();
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
}

export interface Analytics {
  total_applications: number;
  response_rate: number | null;
  average_match_score: number | null;
  funnel: FunnelStage[];
}

export async function getAnalytics(days = 0): Promise<Analytics> {
  const res = await apiFetch(`/api/jobs/analytics?days=${days}`);
  if (!res.ok) throw new Error("Failed to load analytics.");
  return res.json();
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface SearchPreset {
  name: string;
  job_title: string;
  location: string;
}

export interface KanbanColumn {
  id: string;
  label: string;
}

export interface UserSettings {
  default_job_title: string;
  default_location: string;
  result_count: number;
  search_presets: SearchPreset[];
  min_match_score: number;
  auto_score: boolean;
  skills_blacklist: string[];
  stale_days: number;
  kanban_columns: KanbanColumn[];
  dashboard_days: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  default_job_title: "",
  default_location: "",
  result_count: 25,
  search_presets: [],
  min_match_score: 0,
  auto_score: true,
  skills_blacklist: [],
  stale_days: 7,
  kanban_columns: [
    { id: "saved",               label: "Saved" },
    { id: "applied",             label: "Applied" },
    { id: "screening",           label: "Screening" },
    { id: "technical_interview", label: "Technical Interview" },
    { id: "offer",               label: "Offer" },
    { id: "rejected",            label: "Rejected" },
  ],
  dashboard_days: 0,
};

export async function getUserSettings(): Promise<UserSettings> {
  const res = await apiFetch("/api/user-settings/");
  if (!res.ok) throw new Error("Failed to load settings.");
  return res.json();
}

export async function updateUserSettings(s: UserSettings): Promise<UserSettings> {
  const res = await apiFetch("/api/user-settings/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to save settings." }));
    throw new Error(err.detail || "Failed to save settings.");
  }
  return res.json();
}

// ── AI Features ───────────────────────────────────────────────────────────────

export interface InterviewQuestion {
  question: string;
  category: "technical" | "behavioral" | "company" | "problem-solving" | "opener";
  tip: string;
  sample_answer?: string;
}

export async function getInterviewPrep(jobId: number): Promise<{ questions: InterviewQuestion[]; job_title: string | null; company_name: string | null }> {
  const res = await apiFetch(`/api/jobs/${jobId}/interview-prep`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to generate questions." }));
    throw new Error(err.detail || "Failed to generate questions.");
  }
  return res.json();
}

export async function getCompanyBrief(jobId: number): Promise<{ brief: string; company_name: string }> {
  const res = await apiFetch(`/api/jobs/${jobId}/company-brief`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to load company brief." }));
    throw new Error(err.detail || "Failed to load company brief.");
  }
  return res.json();
}

export interface SalaryEstimate {
  min: number;
  max: number;
  currency: string;
  period: string;
  confidence: "high" | "medium" | "low";
  note: string;
  job_title: string | null;
  company_name: string | null;
}

export async function estimateSalary(jobId: number): Promise<SalaryEstimate> {
  const res = await apiFetch(`/api/jobs/${jobId}/salary-estimate`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to estimate salary." }));
    throw new Error(err.detail || "Failed to estimate salary.");
  }
  return res.json();
}

export async function updateJobSalary(id: number, salary: Partial<Pick<Job, "salary_min" | "salary_max" | "salary_currency" | "salary_note">>): Promise<Job> {
  const res = await apiFetch(`/api/jobs/${id}/salary`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(salary),
  });
  if (!res.ok) throw new Error("Failed to save salary.");
  return res.json();
}

export interface SkillGap {
  skill: string;
  frequency: number;
  importance: "high" | "medium" | "low";
  context: string;
}

export async function getSkillGaps(): Promise<{ gaps: SkillGap[]; analyzed_jobs: number; message?: string }> {
  const res = await apiFetch("/api/analytics/skill-gaps");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to load skill gaps." }));
    throw new Error(err.detail || "Failed to load skill gaps.");
  }
  return res.json();
}

export interface RejectionPatterns {
  rejection_rate: number;
  total_rejected: number;
  avg_rejected_score: number | null;
  avg_accepted_score: number | null;
  score_gap: number | null;
  top_rejecting_companies: { company: string; count: number }[];
  score_distribution?: Record<string, number>;
  message?: string;
}

export async function getRejectionPatterns(): Promise<RejectionPatterns> {
  const res = await apiFetch("/api/analytics/rejection-patterns");
  if (!res.ok) throw new Error("Failed to load rejection patterns.");
  return res.json();
}

// ── Scheduled Searches ────────────────────────────────────────────────────────

export interface ScheduledSearch {
  id: number;
  name: string;
  job_title: string;
  location: string;
  platform: string;
  frequency_hours: number;
  result_count: number;
  enabled: boolean;
  last_run: string | null;
  new_jobs_found: number;
  created_at: string;
}

export async function getScheduledSearches(): Promise<ScheduledSearch[]> {
  const res = await apiFetch("/api/scheduled-searches/");
  if (!res.ok) throw new Error("Failed to load scheduled searches.");
  return res.json();
}

export async function createScheduledSearch(s: Omit<ScheduledSearch, "id" | "last_run" | "new_jobs_found" | "created_at">): Promise<ScheduledSearch> {
  const res = await apiFetch("/api/scheduled-searches/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create search." }));
    throw new Error(err.detail || "Failed to create search.");
  }
  return res.json();
}

export async function toggleScheduledSearch(id: number): Promise<ScheduledSearch> {
  const res = await apiFetch(`/api/scheduled-searches/${id}`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to toggle search.");
  return res.json();
}

export async function deleteScheduledSearch(id: number): Promise<void> {
  await apiFetch(`/api/scheduled-searches/${id}`, { method: "DELETE" });
}

export async function runScheduledSearches(): Promise<{ total_new_jobs: number; results: { name: string; new_jobs?: number; error?: string }[] }> {
  const res = await apiFetch("/api/scheduled-searches/run", { method: "POST" });
  if (!res.ok) throw new Error("Failed to run searches.");
  return res.json();
}

// ── App Settings ──────────────────────────────────────────────────────────────

export interface SettingsStatus {
  groq_configured: boolean;
  apify_configured: boolean;
}

export async function getSettingsStatus(): Promise<SettingsStatus> {
  const res = await fetch(`${BASE_URL}/api/settings/`);
  if (!res.ok) throw new Error("Failed to load settings.");
  return res.json();
}

export async function saveSettings(payload: { groq_api_key?: string; apify_api_key?: string }): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/api/settings/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to save settings." }));
    throw new Error(err.detail || "Failed to save settings.");
  }
  return res.json();
}
