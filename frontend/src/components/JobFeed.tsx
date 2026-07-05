import { useEffect, useRef, useState } from "react";
import {
  fetchJobs, getSavedJobs, deleteJob, scoreJobs,
  updateJobStatus, getCompanyBrief, estimateSalary,
} from "../api";
import type { Job, Profile, UserSettings, SearchPreset } from "../api";
import CoverLetterModal from "./CoverLetterModal";
import InterviewPrepModal from "./InterviewPrepModal";

interface Props { profile: Profile | null; settings: UserSettings; }

type ScoringState = "idle" | "scoring" | "done" | "error";

/* Score badge */
function ScoreBadge({ score, loading }: { score: number | null; loading: boolean }) {
  if (loading) return <span className="badge badge-muted"><span className="score-spinner" /> Scoring…</span>;
  if (score === null) return null;
  const cls = score >= 70 ? "badge-green" : score >= 40 ? "badge-amber" : "badge-red";
  return <span className={`badge ${cls}`}>{score}%</span>;
}

/* Salary badge / estimate */
function SalaryRow({ job, onEstimated }: { job: Job; onEstimated: (j: Job) => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (job.salary_min && job.salary_max) {
    return (
      <span className="salary-pill">
        💰 {job.salary_currency || ""} {job.salary_min.toLocaleString()}–{job.salary_max.toLocaleString()}/yr
        {job.salary_note && <span className="salary-info-icon" title={job.salary_note}> ℹ️</span>}
      </span>
    );
  }

  const estimate = async () => {
    setLoading(true); setErr(null);
    try {
      await estimateSalary(job.id);
      const list = await getSavedJobs();
      const found = list.find(j => j.id === job.id);
      if (found) onEstimated(found);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <span>
      <button className="btn-est-salary" onClick={estimate} disabled={loading} title={err || undefined}>
        {loading ? "Estimating…" : "💰 Estimate Salary"}
      </button>
      {err && <span className="salary-err" title={err}>⚠</span>}
    </span>
  );
}

/* Company brief */
function CompanyBrief({ jobId, companyName }: { jobId: number; companyName: string | null }) {
  const [open,    setOpen]    = useState(false);
  const [brief,   setBrief]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  const toggle = async () => {
    if (brief) { setOpen(v => !v); return; }
    setOpen(true); setLoading(true); setErr(null);
    try { const r = await getCompanyBrief(jobId); setBrief(r.brief); }
    catch (e: any) { setErr(e.message || "Failed to load company info."); }
    finally { setLoading(false); }
  };

  return (
    <div className="company-brief">
      <button className="btn-brief" onClick={toggle}>
        🏢 {companyName || "Company"} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="brief-panel">
          {loading && <span style={{ display:"flex",alignItems:"center",gap:8,color:"var(--t2)" }}><span className="spinner-sm" /> Loading company info…</span>}
          {err && <span className="brief-err">⚠ {err}</span>}
          {brief && <p style={{ margin:0,lineHeight:1.7 }}>{brief}</p>}
        </div>
      )}
    </div>
  );
}

export default function JobFeed({ profile, settings }: Props) {
  const [jobTitle,      setJobTitle]      = useState(settings.default_job_title || profile?.current_job_title || "");
  const [location,      setLocation]      = useState(settings.default_location  || "");
  const [platform,      setPlatform]      = useState<"linkedin" | "indeed">("linkedin");
  const [jobs,          setJobs]          = useState<Job[]>([]);
  const [scores,        setScores]        = useState<Record<number, number | null>>({});
  const [fetchingJobs,  setFetchingJobs]  = useState(false);
  const [loadingStored, setLoadingStored] = useState(true);
  const [scoringState,  setScoringState]  = useState<ScoringState>("idle");
  const [scoringIds,    setScoringIds]    = useState<Set<number>>(new Set());
  const [expanded,      setExpanded]      = useState<Set<number>>(new Set());
  const [appliedIds,    setAppliedIds]    = useState<Set<number>>(new Set());
  const [coverLetterId, setCoverLetterId] = useState<number | null>(null);
  const [prepId,        setPrepId]        = useState<number | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [scoreError,    setScoreError]    = useState<string | null>(null);
  const scoringRef = useRef(false);

  /* Sync defaults when settings load */
  useEffect(() => {
    if (settings.default_job_title) setJobTitle(v => v || settings.default_job_title);
    if (settings.default_location)  setLocation(v => v || settings.default_location);
  }, [settings.default_job_title, settings.default_location]);

  /* Load saved jobs on mount */
  useEffect(() => {
    getSavedJobs().then(saved => {
      setJobs(saved);
      const stored: Record<number, number | null> = {};
      for (const j of saved) if (j.match_score != null) stored[j.id] = j.match_score;
      setScores(stored);
      setAppliedIds(new Set(saved.filter(j => j.status !== null).map(j => j.id)));
    }).catch(() => {}).finally(() => setLoadingStored(false));
  }, []);

  /* Pre-fill job title from profile */
  useEffect(() => {
    if (profile?.current_job_title && !jobTitle) setJobTitle(profile.current_job_title);
  }, [profile]);

  const triggerScoring = async (ids: number[]) => {
    if (scoringRef.current || ids.length === 0) return;
    scoringRef.current = true;
    setScoringState("scoring"); setScoringIds(new Set(ids)); setScoreError(null);
    try {
      const results = await scoreJobs(ids, settings.skills_blacklist);
      setScores(prev => {
        const next = { ...prev };
        for (const r of results) if (r.score !== null) next[r.job_id] = r.score;
        return next;
      });
      setScoringState("done");
    } catch (e: any) {
      setScoreError(e.message || "Scoring failed.");
      setScoringState("error");
    } finally {
      scoringRef.current = false;
      setScoringIds(new Set());
    }
  };

  const handleSearch = async () => {
    if (!jobTitle.trim() || !location.trim()) return;
    setError(null); setFetchingJobs(true); scoringRef.current = false;
    try {
      const result = await fetchJobs(jobTitle.trim(), location.trim(), settings.result_count, platform);
      setJobs(result);
      const stored: Record<number, number | null> = {};
      const needsScore: number[] = [];
      for (const j of result) {
        if (j.match_score != null) stored[j.id] = j.match_score;
        else needsScore.push(j.id);
      }
      setScores(prev => ({ ...prev, ...stored }));
      if (settings.auto_score && needsScore.length > 0) {
        scoringRef.current = false;
        triggerScoring(needsScore);
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setFetchingJobs(false);
    }
  };

  const applyPreset = (p: SearchPreset) => { setJobTitle(p.job_title); setLocation(p.location); };

  const sortedJobs = [...jobs]
    .filter(j => { const s = scores[j.id]; return s == null || s >= settings.min_match_score; })
    .sort((a, b) => (scores[b.id] ?? -1) - (scores[a.id] ?? -1));

  const toggleExpand = (id: number) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleDelete = async (id: number) => {
    await deleteJob(id);
    setJobs(prev => prev.filter(j => j.id !== id));
    setScores(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleApply = async (job: Job) => {
    if (job.linkedin_url) window.open(job.linkedin_url, "_blank", "noopener,noreferrer");
    try { await updateJobStatus(job.id, "applied"); setAppliedIds(prev => new Set(prev).add(job.id)); } catch {}
  };

  const updateJob = (updated: Job) => setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));

  const noProfile = !profile;
  const canSearch = !noProfile && !!jobTitle.trim() && !!location.trim() && !fetchingJobs;
  const scoredCount = Object.keys(scores).length;
  const activeJob = coverLetterId !== null ? jobs.find(j => j.id === coverLetterId) : null;
  const prepJob   = prepId        !== null ? jobs.find(j => j.id === prepId)        : null;
  if (coverLetterId !== null) console.log("coverLetterId:", coverLetterId, "activeJob:", activeJob, "jobs ids:", jobs.map(j => j.id));

  return (
    <div className="feed-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Job Feed</h1>
        <p className="page-subtitle">Search LinkedIn & Indeed live — every result scored against your CV with AI.</p>
      </div>

      {/* No profile warning */}
      {noProfile && (
        <div className="banner banner-warning">
          <span>📋</span>
          <span>Upload your CV from <strong>My Profile</strong> before searching for jobs.</span>
        </div>
      )}

      {/* Saved search presets */}
      {settings.search_presets.length > 0 && (
        <div className="presets-row">
          <span className="presets-label">Saved searches:</span>
          {settings.search_presets.map((p, i) => (
            <button key={i} className="preset-tag" onClick={() => applyPreset(p)}>{p.name}</button>
          ))}
        </div>
      )}

      {/* Search box */}
      <div className="search-box">
        <div className="search-row">
          <div className="field">
            <label className="input-label">Job Title</label>
            <input
              className="input"
              placeholder="e.g. Machine Learning Engineer"
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              disabled={noProfile || fetchingJobs}
              onKeyDown={e => e.key === "Enter" && canSearch && handleSearch()}
            />
          </div>
          <div className="field">
            <label className="input-label">Location</label>
            <input
              className="input"
              placeholder="e.g. Bengaluru"
              value={location}
              onChange={e => setLocation(e.target.value)}
              disabled={noProfile || fetchingJobs}
              onKeyDown={e => e.key === "Enter" && canSearch && handleSearch()}
            />
          </div>
          <div className="field">
            <label className="input-label">Platform</label>
            <div className="platform-seg">
              <button className={`seg-btn${platform === "linkedin" ? " active" : ""}`} onClick={() => setPlatform("linkedin")} disabled={fetchingJobs}>LinkedIn</button>
              <button className={`seg-btn${platform === "indeed"   ? " active" : ""}`} onClick={() => setPlatform("indeed")}   disabled={fetchingJobs}>Indeed</button>
            </div>
          </div>
          <div className="field">
            <label className="input-label" style={{ visibility: "hidden" }}>Search</label>
            <button className="btn btn-primary" onClick={handleSearch} disabled={!canSearch}>
              {fetchingJobs ? <><span className="spinner-sm" /> Searching…</> : "🔍 Search Jobs"}
            </button>
          </div>
        </div>
      </div>

      {/* Live searching indicator */}
      {fetchingJobs && (
        <div className="feed-searching">
          <div className="spinner" />
          <span>Searching {platform === "indeed" ? "Indeed" : "LinkedIn"} — this takes 20–60 seconds…</span>
        </div>
      )}

      {/* Errors */}
      {error && <div className="banner banner-error"><span>⚠️</span><span>{error}</span></div>}
      {scoreError && <div className="banner banner-error"><span>⚠️</span><span>{scoreError}</span></div>}

      {/* Scoring progress */}
      {scoringState === "scoring" && (
        <div className="scoring-bar">
          <span className="spinner-sm" />
          <span>Scoring {scoringIds.size} job{scoringIds.size !== 1 ? "s" : ""} against your CV…</span>
          <span className="scoring-bar-right">{scoredCount} / {jobs.length} done</span>
        </div>
      )}

      {/* Manual scoring banner */}
      {!settings.auto_score && scoringState === "idle" && jobs.length > 0 && (
        <div className="banner banner-info" style={{ cursor: "pointer" }} onClick={() => {
          const unscored = jobs.filter(j => scores[j.id] === undefined).map(j => j.id);
          if (unscored.length) triggerScoring(unscored);
        }}>
          <span>🎯</span>
          <span>Auto-scoring is off. <strong>Click here</strong> to score all jobs against your CV now.</span>
        </div>
      )}

      {/* Results count */}
      {!fetchingJobs && jobs.length > 0 && (
        <div className="feed-meta-row">
          <span className="feed-count">
            {sortedJobs.length} job{sortedJobs.length !== 1 ? "s" : ""}
            {settings.min_match_score > 0 && jobs.length !== sortedJobs.length &&
              ` · ${jobs.length - sortedJobs.length} hidden below ${settings.min_match_score}% threshold`}
          </span>
          {scoringState === "done" && <span className="feed-sorted">↓ Sorted by match score</span>}
        </div>
      )}

      {/* Empty state */}
      {!fetchingJobs && !loadingStored && jobs.length === 0 && !error && (
        <div className="empty">
          <span className="empty-icon">📭</span>
          <span className="empty-title">No jobs yet</span>
          <p className="empty-desc">Enter a job title and location above, then click Search Jobs to get started.</p>
        </div>
      )}

      {/* Job list */}
      <div className="jobs-list">
        {sortedJobs.map(job => {
          const isExpanded = expanded.has(job.id);
          const desc    = job.job_description ?? "";
          const preview = desc.length > 220 ? desc.slice(0, 220).trimEnd() + "…" : desc;
          const isScoring = scoringIds.has(job.id);
          const score  = scores[job.id] ?? null;

          return (
            <div key={job.id} className="job-card">
              <div className="job-card-top">
                <div className="job-card-left">
                  <div className="job-title-line">
                    <span className="job-title">{job.job_title || "Untitled Role"}</span>
                    <ScoreBadge score={score} loading={isScoring} />
                  </div>
                  <div className="job-meta-line">
                    {job.company_name && <span className="job-company">{job.company_name}</span>}
                    {job.company_name && job.location && <span className="meta-sep">·</span>}
                    {job.location    && <span className="job-location">📍 {job.location}</span>}
                    <span className="platform-badge">{(job.platform || "linkedin") === "indeed" ? "Indeed" : "LinkedIn"}</span>
                  </div>
                </div>
                <button className="btn-remove-job" title="Remove" onClick={() => handleDelete(job.id)}>✕</button>
              </div>

              {/* Company brief */}
              {job.company_name && <CompanyBrief jobId={job.id} companyName={job.company_name} />}

              {/* Salary */}
              <div><SalaryRow job={job} onEstimated={updateJob} /></div>

              {/* Description */}
              {desc && (
                <div>
                  <p className="job-desc-text">{isExpanded ? desc : preview}</p>
                  {desc.length > 220 && (
                    <button className="btn-desc-toggle" onClick={() => toggleExpand(job.id)}>
                      {isExpanded ? "Show less ▲" : "Show full description ▼"}
                    </button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="card-actions">
                {job.linkedin_url && (
                  <a href={job.linkedin_url} target="_blank" rel="noopener noreferrer" className="btn-view-job">
                    View Job ↗
                  </a>
                )}
                <button
                  className={`btn-apply${appliedIds.has(job.id) ? " btn-applied" : ""}`}
                  onClick={() => !appliedIds.has(job.id) && handleApply(job)}
                >
                  {appliedIds.has(job.id) ? "✓ Applied" : "Apply Now"}
                </button>
                <button className="btn-ai-action btn-ai-cover" onClick={() => setCoverLetterId(job.id)}>
                  ✉ Cover Letter
                </button>
                <button className="btn-ai-action btn-ai-prep" onClick={() => setPrepId(job.id)}>
                  🎤 Interview Prep
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {coverLetterId !== null && activeJob && (
        <CoverLetterModal
          jobId={coverLetterId}
          jobTitle={activeJob.job_title}
          companyName={activeJob.company_name}
          onClose={() => setCoverLetterId(null)}
        />
      )}
      {prepId !== null && prepJob && (
        <InterviewPrepModal
          jobId={prepId}
          jobTitle={prepJob.job_title}
          companyName={prepJob.company_name}
          onClose={() => setPrepId(null)}
        />
      )}
    </div>
  );
}
