import type { Job, KanbanColumn } from "../api";

interface Props {
  jobs: Job[];
  columns: KanbanColumn[];
}

const STATUS_COLORS: Record<string, string> = {
  saved:               "var(--t3)",
  applied:             "#60a5fa",
  screening:           "var(--amber)",
  technical_interview: "var(--accent)",
  offer:               "var(--green)",
  rejected:            "var(--red)",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatRelative(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getStatusColor(status: string | null) {
  if (!status) return "var(--t3)";
  return STATUS_COLORS[status] || "var(--accent)";
}

function getStatusLabel(status: string | null, columns: KanbanColumn[]) {
  if (!status) return "Unknown";
  const col = columns.find((c) => c.id === status);
  return col?.label || status;
}

function scoreClass(score: number) {
  if (score >= 70) return "badge badge-green";
  if (score >= 40) return "badge badge-amber";
  return "badge badge-red";
}

export default function TimelineView({ jobs, columns }: Props) {
  const sorted = [...jobs].sort((a, b) => {
    const ta = new Date(a.status_updated_at || a.created_at).getTime();
    const tb = new Date(b.status_updated_at || b.created_at).getTime();
    return tb - ta;
  });

  if (sorted.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon">📅</span>
        <span className="empty-title">No applications yet</span>
        <p className="empty-desc">Apply to jobs from the Job Feed to see your timeline here.</p>
      </div>
    );
  }

  return (
    <div className="timeline-view">
      <div className="timeline-track">
        {sorted.map((job, idx) => {
          const color = getStatusColor(job.status);
          const label = getStatusLabel(job.status, columns);
          const date = job.status_updated_at || job.created_at;
          return (
            <div key={job.id} className="timeline-item">
              <div className="timeline-left">
                <span className="timeline-date">{formatDate(date)}</span>
                <span className="timeline-rel">{formatRelative(date)}</span>
              </div>

              <div className="timeline-connector">
                <div className="timeline-dot" style={{ background: color, borderColor: color }} />
                {idx < sorted.length - 1 && <div className="timeline-line" />}
              </div>

              <div className="timeline-card">
                <div className="timeline-card-header">
                  <span className="timeline-card-title">{job.job_title || "Untitled Role"}</span>
                  <span className="timeline-status-badge" style={{
                    background: color + "22", color, border: `1px solid ${color}55`,
                  }}>
                    {label}
                  </span>
                </div>
                <div className="timeline-card-meta">
                  <span>{job.company_name || "Unknown Company"}</span>
                  {job.location && <span> · {job.location}</span>}
                </div>
                {job.match_score != null && (
                  <span className={scoreClass(job.match_score)} style={{ marginTop: 4 }}>
                    {job.match_score}% match
                  </span>
                )}
                {job.notes && (
                  <p className="timeline-note">📝 {job.notes.slice(0, 80)}{job.notes.length > 80 ? "…" : ""}</p>
                )}
                {job.salary_min && job.salary_max && (
                  <span className="timeline-salary">
                    💰 {job.salary_currency || ""} {job.salary_min.toLocaleString()}–{job.salary_max.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
