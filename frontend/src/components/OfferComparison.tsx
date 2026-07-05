import type { Job } from "../api";

interface Props {
  jobs: Job[];
  onClose: () => void;
}

function fmt(n: number | null) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function salaryStr(job: Job) {
  if (!job.salary_min && !job.salary_max) return "Not estimated";
  const cur = job.salary_currency || "";
  if (job.salary_min && job.salary_max)
    return `${cur} ${fmt(job.salary_min)} – ${fmt(job.salary_max)} / yr`;
  if (job.salary_max) return `Up to ${cur} ${fmt(job.salary_max)} / yr`;
  return `From ${cur} ${fmt(job.salary_min)} / yr`;
}

const ROWS = [
  { label: "Company",         fn: (j: Job) => j.company_name || "—" },
  { label: "Location",        fn: (j: Job) => j.location || "—" },
  { label: "Match Score",     fn: (j: Job) => j.match_score !== null ? `${j.match_score}%` : "Not scored" },
  { label: "Salary Estimate", fn: (j: Job) => salaryStr(j) },
  { label: "Notes",           fn: (j: Job) => j.notes ? j.notes.slice(0, 80) + (j.notes.length > 80 ? "…" : "") : "—" },
  { label: "Follow-up",       fn: (j: Job) => j.follow_up_date ? new Date(j.follow_up_date).toLocaleDateString() : "—" },
];

export default function OfferComparison({ jobs, onClose }: Props) {
  const offers = jobs.filter((j) => j.status === "offer");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-head">
          <div>
            <h2 className="modal-title">🏆 Offer Comparison</h2>
            <p className="modal-sub">{offers.length} offer{offers.length !== 1 ? "s" : ""} on the table</p>
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {offers.length < 1 && (
            <div className="empty">
              <span className="empty-icon">🏆</span>
              <span className="empty-title">No offers yet</span>
              <p className="empty-desc">Move Kanban cards to the "Offer" column to compare them here.</p>
            </div>
          )}

          {offers.length >= 1 && (
            <div className="comparison-wrap">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th className="comparison-row-lbl">Field</th>
                    {offers.map((j) => (
                      <th key={j.id} className="comparison-col-th">
                        <div className="comparison-job-title">{j.job_title || "Untitled"}</div>
                        <div className="comparison-job-co">{j.company_name || "Unknown"}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.label}>
                      <td className="comparison-row-lbl">{row.label}</td>
                      {offers.map((j) => {
                        const val = row.fn(j);
                        const isScore = row.label === "Match Score" && j.match_score !== null;
                        const scoreClass = isScore
                          ? j.match_score! >= 70 ? "accent-green" : j.match_score! >= 40 ? "accent-amber" : "accent-red"
                          : "";
                        return (
                          <td key={j.id} className={`comparison-cell ${scoreClass}`}>{val}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
