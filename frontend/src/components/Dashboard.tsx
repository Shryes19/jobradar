import { useEffect, useRef, useState, useCallback } from "react";
import { getAnalytics, getSkillGaps, getRejectionPatterns } from "../api";
import type { Analytics, UserSettings, SkillGap, RejectionPatterns } from "../api";

const POLL = 20_000;

/* ─── helpers ─────────────────────────────────────── */
const IMP_COLOR: Record<string, string> = {
  high: "var(--red)", medium: "var(--amber)", low: "var(--t3)",
};

const FUNNEL_COLOR: Record<string, string> = {
  saved:               "var(--t3)",
  applied:             "var(--accent)",
  screening:           "var(--cyan)",
  technical_interview: "var(--amber)",
  offer:               "var(--green)",
  rejected:            "var(--red)",
};

const FUNNEL_ICONS: Record<string, string> = {
  saved: "🔖", applied: "📨", screening: "📞",
  technical_interview: "⚙️", offer: "🏆", rejected: "✖",
};

/* ─── mini donut (SVG) ────────────────────────────── */
function Donut({ pct, color }: { pct: number; color: string }) {
  const r = 22, c = 2 * Math.PI * r;
  const filled = (pct / 100) * c;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
      <circle cx={28} cy={28} r={r} fill="none" stroke="var(--elevated)" strokeWidth={5} />
      <circle
        cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${filled} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
        style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1)" }}
      />
      <text x={28} y={33} textAnchor="middle" fontSize={11} fontWeight={800} fill={color}>{pct}%</text>
    </svg>
  );
}

/* ─── animated counter ───────────────────────────── */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(to / 30);
    const t = setInterval(() => {
      start = Math.min(start + step, to);
      setVal(start);
      if (start >= to) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [to]);
  return <>{val}{suffix}</>;
}

/* ─── sparkline ──────────────────────────────────── */
function Sparkline({ values, color = "var(--accent)" }: { values: number[]; color?: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const W = 120, H = 32;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── SkillGaps ──────────────────────────────────── */
function SkillGapsCard() {
  const [data, setData] = useState<{ gaps: SkillGap[]; analyzed_jobs: number; message?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true); setError(null);
    getSkillGaps()
      .then(d => { setData(d); setLoaded(true); })
      .catch(e => setError(e.message || "Failed to load skill gaps."))
      .finally(() => setLoading(false));
  };

  if (!loaded) return (
    <div className="dash-card dash-card-ai">
      <div className="dash-card-icon-row">
        <span className="dash-ai-icon">🧠</span>
        <div>
          <h3 className="dash-card-h">Skill Gap Analysis</h3>
          <p className="dash-card-sub">AI-powered — spots missing skills from your target roles</p>
        </div>
      </div>
      {error && <div className="banner banner-error"><span>⚠️</span><span>{error}</span></div>}
      <button className="btn btn-primary" onClick={load} disabled={loading} style={{ marginTop: 4 }}>
        {loading ? <><span className="spinner-sm" /> Analysing…</> : "Analyse Skill Gaps"}
      </button>
    </div>
  );

  if (data?.message) return (
    <div className="dash-card dash-card-ai">
      <div className="dash-card-icon-row">
        <span className="dash-ai-icon">🧠</span>
        <h3 className="dash-card-h">Skill Gap Analysis</h3>
      </div>
      <div className="empty-inline">{data.message}</div>
    </div>
  );

  return (
    <div className="dash-card dash-card-ai">
      <div className="dash-card-toprow">
        <div className="dash-card-icon-row">
          <span className="dash-ai-icon">🧠</span>
          <div>
            <h3 className="dash-card-h">Skill Gap Analysis</h3>
            <p className="dash-card-sub">Based on {data?.analyzed_jobs} tracked job{data?.analyzed_jobs !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button className="btn-icon" onClick={load} disabled={loading} title="Refresh">↻</button>
      </div>
      <div className="gap-list-v2">
        {(data?.gaps || []).map((gap, i) => {
          const pct = Math.round(Math.min((gap.frequency / (data?.analyzed_jobs || 1)) * 100, 100));
          return (
            <div key={i} className="gap-item-v2">
              <div className="gap-head">
                <span className="gap-skill-v2">{gap.skill}</span>
                <span className="gap-badge" style={{ background: IMP_COLOR[gap.importance] + "22", color: IMP_COLOR[gap.importance] }}>
                  {gap.importance}
                </span>
                <span className="gap-freq">{gap.frequency}/{data?.analyzed_jobs} jobs</span>
              </div>
              <div className="gap-track-v2">
                <div className="gap-fill-v2" style={{ width: `${pct}%`, background: IMP_COLOR[gap.importance] }} />
              </div>
              <p className="gap-ctx">{gap.context}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── RejectionCard ──────────────────────────────── */
function RejectionCard() {
  const [data, setData] = useState<RejectionPatterns | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true); setError(null);
    getRejectionPatterns()
      .then(d => { setData(d); setLoaded(true); })
      .catch(e => setError(e.message || "Failed to load rejection patterns."))
      .finally(() => setLoading(false));
  };

  if (!loaded) return (
    <div className="dash-card dash-card-ai">
      <div className="dash-card-icon-row">
        <span className="dash-ai-icon">🔍</span>
        <div>
          <h3 className="dash-card-h">Rejection Patterns</h3>
          <p className="dash-card-sub">Understand why applications stall — fix before applying again</p>
        </div>
      </div>
      {error && <div className="banner banner-error"><span>⚠️</span><span>{error}</span></div>}
      <button className="btn btn-primary" onClick={load} disabled={loading} style={{ marginTop: 4 }}>
        {loading ? <><span className="spinner-sm" /> Loading…</> : "Analyse Rejections"}
      </button>
    </div>
  );

  if (data?.message) return (
    <div className="dash-card dash-card-ai">
      <div className="dash-card-icon-row">
        <span className="dash-ai-icon">🔍</span>
        <h3 className="dash-card-h">Rejection Patterns</h3>
      </div>
      <div className="empty-inline">{data.message}</div>
    </div>
  );

  const dist = data?.score_distribution;
  const maxDist = dist ? Math.max(...Object.values(dist), 1) : 1;

  return (
    <div className="dash-card dash-card-ai">
      <div className="dash-card-toprow">
        <div className="dash-card-icon-row">
          <span className="dash-ai-icon">🔍</span>
          <div>
            <h3 className="dash-card-h">Rejection Patterns</h3>
            <p className="dash-card-sub">{data?.total_rejected} rejection{data?.total_rejected !== 1 ? "s" : ""} analysed</p>
          </div>
        </div>
        <button className="btn-icon" onClick={load} disabled={loading} title="Refresh">↻</button>
      </div>

      {/* KPI row */}
      <div className="rej-kpi-row">
        <div className="rej-kpi">
          <span className="rej-kpi-val" style={{ color: "var(--amber)" }}>{data?.rejection_rate}%</span>
          <span className="rej-kpi-lbl">Rejection rate</span>
        </div>
        <div className="rej-kpi">
          <span className="rej-kpi-val">{data?.avg_rejected_score != null ? `${data!.avg_rejected_score}` : "—"}</span>
          <span className="rej-kpi-lbl">Avg score rejected</span>
        </div>
        <div className="rej-kpi">
          <span className="rej-kpi-val" style={{ color: "var(--green)" }}>
            {data?.avg_accepted_score != null ? `${data!.avg_accepted_score}` : "—"}
          </span>
          <span className="rej-kpi-lbl">Avg score progressed</span>
        </div>
        {data?.score_gap != null && (
          <div className="rej-kpi">
            <span className="rej-kpi-val" style={{ color: "var(--green)" }}>+{data.score_gap}</span>
            <span className="rej-kpi-lbl">Gap to bridge</span>
          </div>
        )}
      </div>

      {/* Score distribution */}
      {dist && (
        <div>
          <p className="dash-section-lbl">Score distribution of rejections</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {Object.entries(dist).map(([bucket, count]) => (
              <div key={bucket} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--t3)", width: 52, flexShrink: 0 }}>{bucket}</span>
                <div style={{ flex: 1, height: 18, background: "var(--elevated)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    width: `${(count / maxDist) * 100}%`,
                    background: bucket === "80+" ? "var(--red)" : bucket === "unscored" ? "var(--t3)" : "var(--amber)",
                    transition: "width .5s var(--ease)",
                    opacity: .85,
                  }} />
                </div>
                <span style={{ fontSize: 11, color: "var(--t3)", width: 18, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top companies */}
      {data?.top_rejecting_companies && data.top_rejecting_companies.length > 0 && (
        <div>
          <p className="dash-section-lbl">Most rejections from</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {data.top_rejecting_companies.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
                <span style={{ color: "var(--t2)" }}>{c.company}</span>
                <span style={{ color: "var(--amber)", fontWeight: 700 }}>{c.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ MAIN DASHBOARD ═════════════════════════════════ */
export default function Dashboard({ settings, onSettingChange }: {
  settings: UserSettings;
  onSettingChange?: (key: keyof UserSettings, val: unknown) => void;
}) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDays, setActiveDays] = useState(settings.dashboard_days ?? 0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback((days: number) => {
    getAnalytics(days)
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message || "Failed to load analytics."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    load(activeDays);
    interval.current = setInterval(() => load(activeDays), POLL);
    return () => { if (interval.current) clearInterval(interval.current); };
  }, [activeDays, load]);

  const handleDaySwitch = (d: number) => {
    setActiveDays(d);
    onSettingChange?.("dashboard_days", d);
  };

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      <p style={{ color: "var(--t3)", marginTop: 12 }}>Loading analytics…</p>
    </div>
  );

  if (error) return (
    <div className="dash-page">
      <h1 className="page-title">Analytics</h1>
      <div className="banner banner-error"><span>⚠️</span><span>{error}</span></div>
    </div>
  );

  const noData = !data || data.total_applications === 0;
  const dashMax = data ? Math.max(...data.funnel.map(d => d.count), 1) : 1;

  /* derive quick stats */
  const totalApps = data?.total_applications ?? 0;
  const responseRate = data?.response_rate != null ? Math.round(data.response_rate) : null;
  const avgScore = data?.average_match_score != null ? Math.round(data.average_match_score) : null;

  const offerCount  = data?.funnel.find(f => f.stage === "offer")?.count ?? 0;
  const rejCount    = data?.funnel.find(f => f.stage === "rejected")?.count ?? 0;
  const activeCount = data?.funnel
    .filter(f => !["saved", "rejected"].includes(f.stage))
    .reduce((s, f) => s + f.count, 0) ?? 0;

  /* sparkline across pipeline stages (exclude saved/rejected for visual clarity) */
  const sparkValues = (data?.funnel ?? [])
    .filter(f => !["saved", "rejected"].includes(f.stage))
    .map(f => f.count);

  return (
    <div className="dash-page">
      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">
            {activeDays === 0 ? "All-time" : `Last ${activeDays} days`}
            {" · "}auto-refreshes every 20 s
          </p>
        </div>
        <div className="seg-group">
          {[0, 7, 30, 90].map(d => (
            <button
              key={d}
              className={`seg-btn${activeDays === d ? " active" : ""}`}
              onClick={() => handleDaySwitch(d)}
            >
              {d === 0 ? "All time" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {noData ? (
        <div className="empty">
          <span className="empty-icon">📊</span>
          <span className="empty-title">No data yet</span>
          <p className="empty-desc">Apply to jobs from the Job Feed to start seeing your analytics here.</p>
        </div>
      ) : (
        <>
          {/* ── Hero stat cards ── */}
          <div className="dash-hero-grid">
            <div className="dash-hero-card" style={{ "--hc": "var(--accent)" } as React.CSSProperties}>
              <div className="dash-hero-label">Total Applications</div>
              <div className="dash-hero-value" style={{ color: "var(--accent-text)" }}>
                <Counter to={totalApps} />
              </div>
              <div className="dash-hero-spark">
                <Sparkline values={sparkValues} color="var(--accent)" />
              </div>
            </div>

            <div className="dash-hero-card" style={{ "--hc": "var(--green)" } as React.CSSProperties}>
              <div className="dash-hero-label">Response Rate</div>
              <div className="dash-hero-value" style={{ color: "var(--green)" }}>
                {responseRate !== null ? <Counter to={responseRate} suffix="%" /> : "—"}
              </div>
              {responseRate !== null && <Donut pct={responseRate} color="var(--green)" />}
            </div>

            <div className="dash-hero-card" style={{ "--hc": "var(--cyan)" } as React.CSSProperties}>
              <div className="dash-hero-label">Avg Match Score</div>
              <div className="dash-hero-value" style={{ color: "var(--cyan)" }}>
                {avgScore !== null ? <Counter to={avgScore} suffix="%" /> : "—"}
              </div>
              {avgScore !== null && <Donut pct={avgScore} color="var(--cyan)" />}
            </div>

            <div className="dash-hero-card" style={{ "--hc": "#ec4899" } as React.CSSProperties}>
              <div className="dash-hero-label">Active Pipeline</div>
              <div className="dash-hero-value" style={{ color: "#ec4899" }}>
                <Counter to={activeCount} />
              </div>
              <div className="dash-hero-sub">
                {offerCount > 0 && <span style={{ color: "var(--green)", fontSize: 11, fontWeight: 700 }}>🏆 {offerCount} offer{offerCount !== 1 ? "s" : ""}</span>}
                {rejCount > 0 && <span style={{ color: "var(--t3)", fontSize: 11 }}> · {rejCount} rejected</span>}
              </div>
            </div>
          </div>

          {/* ── Application Funnel ── */}
          <div className="dash-card">
            <div className="dash-card-toprow">
              <div>
                <h3 className="dash-card-h">Application Funnel</h3>
                <p className="dash-card-sub">How many jobs are at each stage of your pipeline</p>
              </div>
              <div className="dash-funnel-total">
                <span style={{ fontSize: 22, fontWeight: 900, color: "var(--t1)" }}>{totalApps}</span>
                <span style={{ fontSize: 11, color: "var(--t3)" }}>total</span>
              </div>
            </div>
            <div className="dash-funnel">
              {data!.funnel.map((stage) => {
                const pct = Math.round((stage.count / dashMax) * 100);
                const color = FUNNEL_COLOR[stage.stage] || "var(--accent)";
                const icon = FUNNEL_ICONS[stage.stage] || "•";
                return (
                  <div key={stage.stage} className="dash-funnel-row">
                    <div className="dash-funnel-lbl">
                      <span>{icon}</span>
                      <span>{stage.label}</span>
                    </div>
                    <div className="dash-funnel-track">
                      <div
                        className="dash-funnel-fill"
                        style={{ width: `${pct}%`, background: color }}
                        title={`${stage.count} jobs`}
                      />
                    </div>
                    <div className="dash-funnel-right">
                      <span className="dash-funnel-num" style={{ color }}>{stage.count}</span>
                      <span className="dash-funnel-pct">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Status breakdown (horizontal bar chart) ── */}
          <div className="dash-card">
            <h3 className="dash-card-h">Pipeline Breakdown</h3>
            <p className="dash-card-sub" style={{ marginBottom: 16 }}>Proportion of applications in each stage</p>
            <div className="dash-breakdown-bar">
              {data!.funnel.filter(f => f.count > 0).map((stage) => {
                const pct = (stage.count / (totalApps + (data!.funnel.find(f => f.stage === "saved")?.count ?? 0))) * 100;
                const color = FUNNEL_COLOR[stage.stage] || "var(--accent)";
                return (
                  <div
                    key={stage.stage}
                    className="dash-breakdown-seg"
                    style={{ width: `${pct}%`, background: color }}
                    title={`${stage.label}: ${stage.count} (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>
            <div className="dash-breakdown-legend">
              {data!.funnel.filter(f => f.count > 0).map((stage) => (
                <div key={stage.stage} className="dash-legend-item">
                  <span className="dash-legend-dot" style={{ background: FUNNEL_COLOR[stage.stage] || "var(--accent)" }} />
                  <span className="dash-legend-lbl">{stage.label}</span>
                  <span className="dash-legend-val">{stage.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── AI analysis cards ── */}
      <div className="dash-ai-grid">
        <SkillGapsCard />
        <RejectionCard />
      </div>
    </div>
  );
}
