import { useCallback, useEffect, useRef, useState } from "react";
import { getTrackerJobs, updateJobStatus, updateJobNotes, updateFollowUpDate } from "../api";
import type { Job, UserSettings } from "../api";
import TimelineView from "./TimelineView";
import InterviewPrepModal from "./InterviewPrepModal";
import OfferComparison from "./OfferComparison";

interface Props { settings: UserSettings; }

function scoreClass(score: number | null) {
  if (score === null) return "";
  if (score >= 70) return "badge-green";
  if (score >= 40) return "badge-amber";
  return "badge-red";
}

function fmtTs(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isStale(iso: string | null, staleDays: number) {
  if (!iso || staleDays === 0) return false;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000 >= staleDays;
}

function isFollowUpDue(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() <= Date.now();
}

function NoteEditor({ job, onSaved }: { job: Job; onSaved: (j: Job) => void }) {
  const [open,   setOpen]   = useState(false);
  const [text,   setText]   = useState(job.notes ?? "");
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setText(job.notes ?? ""); }, [job.notes]);

  const save = useCallback(async (value: string) => {
    setSaving(true);
    try { const u = await updateJobNotes(job.id, value); onSaved(u); } catch {}
    finally { setSaving(false); }
  }, [job.id, onSaved]);

  const onChange = (val: string) => {
    setText(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(val), 800);
  };

  const hasNote = (job.notes ?? "").trim().length > 0;

  return (
    <div className="note-editor">
      <button
        className={`btn-note-toggle${hasNote ? " has-note" : ""}`}
        onClick={() => setOpen(v => !v)}
      >
        📝 {hasNote && !open ? (job.notes!.slice(0, 38) + (job.notes!.length > 38 ? "…" : "")) : open ? "Close notes" : "Add note…"}
      </button>
      {open && (
        <div className="note-panel">
          <textarea
            className="note-textarea"
            value={text}
            onChange={e => onChange(e.target.value)}
            placeholder="Recruiter name, salary discussed, feedback…"
            rows={4}
          />
          <span className="note-save-status">
            {saving ? "Saving…" : text === (job.notes ?? "") ? "Saved ✓" : "Unsaved"}
          </span>
        </div>
      )}
    </div>
  );
}

function FollowUp({ job, onSaved }: { job: Job; onSaved: (j: Job) => void }) {
  const [saving, setSaving] = useState(false);
  const due = isFollowUpDue(job.follow_up_date);

  const onChange = async (val: string) => {
    setSaving(true);
    try { const u = await updateFollowUpDate(job.id, val || null); onSaved(u); } catch {}
    finally { setSaving(false); }
  };

  const dateVal = job.follow_up_date
    ? new Date(job.follow_up_date).toISOString().slice(0, 10)
    : "";

  return (
    <div className={`followup-row${due ? " due" : ""}`}>
      <span className="followup-label">{due ? "⏰" : "📅"} Follow up:</span>
      <input
        type="date"
        className="followup-input"
        value={dateVal}
        onChange={e => onChange(e.target.value)}
        disabled={saving}
      />
      {job.follow_up_date && (
        <button className="btn-remove-item" onClick={() => onChange("")} title="Clear" style={{ padding: "0 5px" }}>✕</button>
      )}
    </div>
  );
}

type ViewMode = "kanban" | "timeline";

export default function Tracker({ settings }: Props) {
  const [jobs,               setJobs]               = useState<Job[]>([]);
  const [loading,            setLoading]             = useState(true);
  const [error,              setError]               = useState<string | null>(null);
  const [dragId,             setDragId]              = useState<number | null>(null);
  const [dragOverCol,        setDragOverCol]         = useState<string | null>(null);
  const [viewMode,           setViewMode]            = useState<ViewMode>("kanban");
  const [prepJobId,          setPrepJobId]           = useState<number | null>(null);
  const [showOfferComparison,setShowOfferComparison] = useState(false);
  const dragNode = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getTrackerJobs()
      .then(setJobs)
      .catch(() => setError("Failed to load tracker. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const updateJob = useCallback((u: Job) => {
    setJobs(prev => prev.map(j => j.id === u.id ? u : j));
  }, []);

  const jobsByCol = (colId: string) => jobs.filter(j => j.status === colId);

  const onDragStart = (e: React.DragEvent, job: Job) => {
    setDragId(job.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(job.id));
    if (e.currentTarget instanceof HTMLElement) {
      dragNode.current = e.currentTarget as HTMLDivElement;
      setTimeout(() => { if (dragNode.current) dragNode.current.classList.add("dragging"); }, 0);
    }
  };

  const onDragEnd = () => {
    setDragId(null); setDragOverCol(null);
    if (dragNode.current) { dragNode.current.classList.remove("dragging"); dragNode.current = null; }
  };

  const onDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault(); setDragOverCol(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (!id || isNaN(id)) return;
    const job = jobs.find(j => j.id === id);
    if (!job || job.status === colId) return;
    const now = new Date().toISOString();
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: colId, status_updated_at: now } : j));
    try {
      const updated = await updateJobStatus(id, colId);
      setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
    } catch (err: any) {
      setJobs(prev => prev.map(j => j.id === id ? job : j));
      setError(err.message || "Failed to move card.");
    }
  };

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      <p>Loading your pipeline…</p>
    </div>
  );

  const columns  = settings.kanban_columns;
  const offerJobs = jobs.filter(j => j.status === "offer");
  const prepJob  = prepJobId !== null ? jobs.find(j => j.id === prepJobId) : null;

  return (
    <div className="tracker-page">
      {/* Header */}
      <div className="tracker-topbar">
        <div>
          <h1 className="page-title">Application Tracker</h1>
          <p className="page-subtitle">
            {viewMode === "kanban"
              ? "Drag cards between columns to update status. Click a card to add notes."
              : "Chronological view of all your applications."}
          </p>
        </div>
        <div className="tracker-actions">
          {offerJobs.length > 0 && (
            <button className="btn-compare-offers" onClick={() => setShowOfferComparison(true)}>
              🏆 Compare {offerJobs.length} Offer{offerJobs.length > 1 ? "s" : ""}
            </button>
          )}
          <div className="view-seg">
            <button className={`view-seg-btn${viewMode === "kanban"   ? " active" : ""}`} onClick={() => setViewMode("kanban")}>Kanban</button>
            <button className={`view-seg-btn${viewMode === "timeline" ? " active" : ""}`} onClick={() => setViewMode("timeline")}>Timeline</button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="banner banner-error">
          <span>⚠️</span>
          <span>{error}</span>
          <button className="toast-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Empty */}
      {jobs.length === 0 && !loading && (
        <div className="empty">
          <span className="empty-icon">📌</span>
          <span className="empty-title">No applications tracked yet</span>
          <p className="empty-desc">Apply to jobs from the Job Feed to start tracking your pipeline here.</p>
        </div>
      )}

      {/* Timeline view */}
      {viewMode === "timeline" && jobs.length > 0 && (
        <TimelineView jobs={jobs} columns={columns} />
      )}

      {/* Kanban board */}
      {viewMode === "kanban" && jobs.length > 0 && (
        <div className="kanban-board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))` }}>
          {columns.map(col => {
            const colJobs = jobsByCol(col.id);
            const isOver  = dragOverCol === col.id;
            return (
              <div
                key={col.id}
                className={`kanban-col${isOver ? " drop-target" : ""}`}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(col.id); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => onDrop(e, col.id)}
              >
                <div className="kanban-col-head">
                  <span className="kanban-col-name">{col.label}</span>
                  <span className="kanban-col-cnt">{colJobs.length}</span>
                </div>

                <div className="kanban-cards">
                  {colJobs.length === 0 && <div className="kanban-drop-hint">Drop here</div>}
                  {colJobs.map(job => {
                    const stale = isStale(job.status_updated_at, settings.stale_days);
                    return (
                      <div
                        key={job.id}
                        className={`kanban-card${dragId === job.id ? " dragging" : ""}${stale ? " stale" : ""}`}
                        draggable
                        onDragStart={e => onDragStart(e, job)}
                        onDragEnd={onDragEnd}
                      >
                        <div className="kcard-title">{job.job_title || "Untitled Role"}</div>
                        <div className="kcard-company">{job.company_name || "Unknown"}</div>

                        {job.match_score != null && (
                          <span className={`badge ${scoreClass(job.match_score)}`}>{job.match_score}%</span>
                        )}

                        {job.salary_min && job.salary_max && (
                          <span className="kcard-salary">
                            💰 {job.salary_currency} {job.salary_min.toLocaleString()}–{job.salary_max.toLocaleString()}
                          </span>
                        )}

                        {job.status_updated_at && (
                          <div className={`kcard-ts${stale ? " stale-ts" : ""}`}>
                            {stale ? "⏰ Stale — " : ""}{fmtTs(job.status_updated_at)}
                          </div>
                        )}

                        <NoteEditor job={job} onSaved={updateJob} />
                        <FollowUp job={job} onSaved={updateJob} />

                        <button className="btn-prep-mini" onClick={() => setPrepJobId(job.id)}>
                          🎤 Interview Prep
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {prepJobId !== null && prepJob && (
        <InterviewPrepModal
          jobId={prepJobId}
          jobTitle={prepJob.job_title}
          companyName={prepJob.company_name}
          onClose={() => setPrepJobId(null)}
        />
      )}

      {showOfferComparison && (
        <OfferComparison jobs={jobs} onClose={() => setShowOfferComparison(false)} />
      )}
    </div>
  );
}
