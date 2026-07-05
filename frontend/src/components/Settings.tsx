import { useEffect, useState } from "react";
import { updateUserSettings, getScheduledSearches, createScheduledSearch, toggleScheduledSearch, deleteScheduledSearch, runScheduledSearches, getSettingsStatus, saveSettings } from "../api";
import type { UserSettings, ScheduledSearch } from "../api";

interface Props {
  settings: UserSettings;
  onClose: () => void;
  onSaved: (s: UserSettings) => void;
}

type Section = "apikeys" | "search" | "scoring" | "tracker" | "dashboard" | "alerts";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "apikeys",   label: "API Keys",      icon: "🔑" },
  { id: "search",    label: "Job Search",    icon: "🔍" },
  { id: "scoring",   label: "Scoring",       icon: "⭐" },
  { id: "tracker",   label: "Tracker",       icon: "📌" },
  { id: "dashboard", label: "Dashboard",     icon: "📊" },
  { id: "alerts",    label: "Job Alerts",    icon: "🔔" },
];

function ApiKeysTab() {
  const [groqKey,   setGroqKey]   = useState("");
  const [apifyKey,  setApifyKey]  = useState("");
  const [status,    setStatus]    = useState<{ groq_configured: boolean; apify_configured: boolean } | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState<string | null>(null);
  const [err,       setErr]       = useState<string | null>(null);
  const [showGroq,  setShowGroq]  = useState(false);
  const [showApify, setShowApify] = useState(false);

  useEffect(() => {
    getSettingsStatus().then(setStatus).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const payload: { groq_api_key?: string; apify_api_key?: string } = {};
      if (groqKey.trim())  payload.groq_api_key  = groqKey.trim();
      if (apifyKey.trim()) payload.apify_api_key = apifyKey.trim();
      if (!payload.groq_api_key && !payload.apify_api_key) {
        setErr("Enter at least one API key to save."); setSaving(false); return;
      }
      await saveSettings(payload);
      const fresh = await getSettingsStatus();
      setStatus(fresh);
      setGroqKey(""); setApifyKey("");
      setMsg("API keys saved. Restart the backend for changes to take effect if already running.");
    } catch (e: any) { setErr(e.message || "Failed to save keys."); }
    finally { setSaving(false); }
  };

  const Dot = ({ ok }: { ok: boolean }) => (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: ok ? "var(--green)" : "var(--red)", marginRight: 6,
    }} />
  );

  return (
    <div className="settings-section">
      <p className="settings-section-desc">
        JobRadar needs two API keys to function. Both are free to obtain. Keys are stored in
        <code style={{ background: "var(--elevated)", padding: "1px 5px", borderRadius: 4, fontSize: 11, margin: "0 4px" }}>backend/.env</code>
        and never leave your machine.
      </p>

      {status && (
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div className="alert-item" style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)", marginBottom: 4 }}>Groq API</div>
            <div style={{ fontSize: 13, color: status.groq_configured ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
              <Dot ok={status.groq_configured} />{status.groq_configured ? "Configured ✓" : "Not configured"}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Powers CV parsing, scoring, cover letters, interview prep</div>
          </div>
          <div className="alert-item" style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)", marginBottom: 4 }}>Apify API</div>
            <div style={{ fontSize: 13, color: status.apify_configured ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
              <Dot ok={status.apify_configured} />{status.apify_configured ? "Configured ✓" : "Not configured"}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>Powers live job scraping from LinkedIn & Indeed</div>
          </div>
        </div>
      )}

      {err && <div className="banner banner-error" style={{ marginBottom: 14 }}><span>⚠️</span><span>{err}</span></div>}
      {msg && <div className="banner banner-success" style={{ marginBottom: 14 }}><span>✓</span><span>{msg}</span></div>}

      <div className="settings-field">
        <label className="settings-label">
          Groq API Key
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer"
            style={{ marginLeft: 8, fontSize: 11, color: "var(--accent-text)", textDecoration: "none" }}>
            Get free key →
          </a>
        </label>
        <p className="settings-field-hint">Free tier. Sign up at console.groq.com — no credit card required.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input
            className="input"
            type={showGroq ? "text" : "password"}
            placeholder="gsk_..."
            value={groqKey}
            onChange={e => setGroqKey(e.target.value)}
            style={{ flex: 1, fontFamily: groqKey ? "monospace" : "inherit" }}
          />
          <button className="btn-eye" onClick={() => setShowGroq(v => !v)} title={showGroq ? "Hide" : "Show"}>
            {showGroq ? "🙈" : "👁"}
          </button>
        </div>
      </div>

      <div className="settings-field">
        <label className="settings-label">
          Apify API Key
          <a href="https://console.apify.com/account/integrations" target="_blank" rel="noreferrer"
            style={{ marginLeft: 8, fontSize: 11, color: "var(--accent-text)", textDecoration: "none" }}>
            Get free key →
          </a>
        </label>
        <p className="settings-field-hint">Free tier includes ~$5/month of usage — enough for hundreds of job searches.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input
            className="input"
            type={showApify ? "text" : "password"}
            placeholder="apify_api_..."
            value={apifyKey}
            onChange={e => setApifyKey(e.target.value)}
            style={{ flex: 1, fontFamily: apifyKey ? "monospace" : "inherit" }}
          />
          <button className="btn-eye" onClick={() => setShowApify(v => !v)} title={showApify ? "Hide" : "Show"}>
            {showApify ? "🙈" : "👁"}
          </button>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 8 }}>
        {saving ? <><span className="spinner-sm" /> Saving…</> : "Save API Keys"}
      </button>
    </div>
  );
}

function ScheduledSearchesTab() {
  const [searches,  setSearches]  = useState<ScheduledSearch[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [running,   setRunning]   = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  const [name,           setName]           = useState("");
  const [jobTitle,       setJobTitle]       = useState("");
  const [location,       setLocation]       = useState("");
  const [platform,       setPlatform]       = useState("linkedin");
  const [frequencyHours, setFrequencyHours] = useState(24);
  const [resultCount,    setResultCount]    = useState(15);
  const [adding,         setAdding]         = useState(false);

  useEffect(() => {
    getScheduledSearches()
      .then(setSearches)
      .catch(() => setError("Failed to load scheduled searches."))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!name.trim() || !jobTitle.trim() || !location.trim()) return;
    setAdding(true);
    try {
      const s = await createScheduledSearch({ name: name.trim(), job_title: jobTitle.trim(), location: location.trim(), platform, frequency_hours: frequencyHours, result_count: resultCount, enabled: true });
      setSearches(prev => [s, ...prev]);
      setName(""); setJobTitle(""); setLocation(""); setPlatform("linkedin"); setFrequencyHours(24); setResultCount(15);
    } catch (e: any) { setError(e.message || "Failed to add search."); }
    finally { setAdding(false); }
  };

  const handleToggle = async (id: number) => {
    try {
      const updated = await toggleScheduledSearch(id);
      setSearches(prev => prev.map(s => s.id === id ? updated : s));
    } catch { }
  };

  const handleDelete = async (id: number) => {
    await deleteScheduledSearch(id);
    setSearches(prev => prev.filter(s => s.id !== id));
  };

  const handleRunNow = async () => {
    setRunning(true); setRunResult(null);
    try {
      const result = await runScheduledSearches();
      setRunResult(`Ran ${result.results.length} search${result.results.length !== 1 ? "es" : ""}, found ${result.total_new_jobs} new job${result.total_new_jobs !== 1 ? "s" : ""}.`);
      const fresh = await getScheduledSearches();
      setSearches(fresh);
    } catch (e: any) { setError(e.message || "Failed to run searches."); }
    finally { setRunning(false); }
  };

  return (
    <div className="settings-section">
      <p className="settings-section-desc">
        Configure searches that run automatically on a schedule. Click "Run Now" to immediately check for new jobs across all enabled searches.
      </p>

      {error     && <div className="banner banner-error" style={{ marginBottom: 8 }}><span>⚠️</span><span>{error}</span></div>}
      {runResult && <div className="banner banner-info"  style={{ marginBottom: 8 }}><span>✓</span><span>{runResult}</span></div>}

      {searches.length > 0 && (
        <button className="btn btn-primary" onClick={handleRunNow} disabled={running} style={{ marginBottom: 16 }}>
          {running ? <><span className="spinner-sm" /> Checking…</> : "▶ Run All Now"}
        </button>
      )}

      {loading && <p className="settings-field-hint">Loading…</p>}

      {searches.map(s => (
        <div key={s.id} className="alert-item">
          <div className="alert-item-top">
            <span className={`alert-item-name${s.enabled ? "" : " disabled"}`}>{s.name}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className={`toggle-btn${s.enabled ? " on" : ""}`} onClick={() => handleToggle(s.id)}>
                <span className="toggle-knob" />
              </button>
              <button className="btn-remove-item" onClick={() => handleDelete(s.id)}>✕</button>
            </div>
          </div>
          <div className="alert-item-detail">
            <span>{s.job_title} · {s.location}</span>
            <span className="alert-item-meta">
              {s.platform === "indeed" ? "Indeed" : "LinkedIn"} · every {s.frequency_hours}h
              {s.last_run ? ` · last ran ${new Date(s.last_run).toLocaleDateString()}` : " · never run"}
              {s.new_jobs_found > 0 && ` · ${s.new_jobs_found} new`}
            </span>
          </div>
        </div>
      ))}

      <div className="settings-field" style={{ marginTop: 16 }}>
        <label className="settings-label">Add New Scheduled Search</label>
        <div className="alert-add-grid">
          <div className="settings-field">
            <label className="settings-label">Alert Name</label>
            <input className="input" placeholder="e.g. ML Engineer Daily" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="settings-field">
            <label className="settings-label">Job Title</label>
            <input className="input" placeholder="e.g. Machine Learning Engineer" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
          </div>
          <div className="settings-field">
            <label className="settings-label">Location</label>
            <input className="input" placeholder="e.g. Bengaluru" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="settings-field">
            <label className="settings-label">Platform</label>
            <div className="platform-seg" style={{ marginTop: 4 }}>
              <button className={`seg-btn${platform === "linkedin" ? " active" : ""}`} onClick={() => setPlatform("linkedin")}>LinkedIn</button>
              <button className={`seg-btn${platform === "indeed"   ? " active" : ""}`} onClick={() => setPlatform("indeed")}>Indeed</button>
            </div>
          </div>
          <div className="settings-field">
            <label className="settings-label">Frequency — every <span style={{ color: "var(--green)" }}>{frequencyHours}h</span></label>
            <input type="range" min={6} max={168} step={6} value={frequencyHours} onChange={e => setFrequencyHours(Number(e.target.value))} className="settings-range" />
            <div className="settings-range-labels"><span>6h</span><span>Weekly</span></div>
          </div>
          <div className="settings-field">
            <label className="settings-label">Results per run — <span style={{ color: "var(--green)" }}>{resultCount}</span></label>
            <input type="range" min={10} max={50} step={5} value={resultCount} onChange={e => setResultCount(Number(e.target.value))} className="settings-range" />
            <div className="settings-range-labels"><span>10</span><span>50</span></div>
          </div>
        </div>
        <button className="btn-add-item" onClick={handleAdd} disabled={adding || !name.trim() || !jobTitle.trim() || !location.trim()} style={{ marginTop: 12 }}>
          {adding ? "Adding…" : "+ Add Alert"}
        </button>
      </div>
    </div>
  );
}

export default function Settings({ settings, onClose, onSaved }: Props) {
  const [draft,   setDraft]   = useState<UserSettings>({ ...settings, kanban_columns: [...settings.kanban_columns] });
  const [section, setSection] = useState<Section>("search");
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [newPresetName,  setNewPresetName]  = useState("");
  const [newPresetTitle, setNewPresetTitle] = useState("");
  const [newPresetLoc,   setNewPresetLoc]   = useState("");
  const [newSkill,       setNewSkill]       = useState("");
  const [newColLabel,    setNewColLabel]    = useState("");

  const set = (patch: Partial<UserSettings>) => {
    setDraft(d => ({ ...d, ...patch }));
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(false);
    try {
      const saved = await updateUserSettings(draft);
      onSaved(saved);
      setSuccess(true);
    } catch (e: any) { setError(e.message || "Failed to save settings."); }
    finally { setSaving(false); }
  };

  const addPreset = () => {
    if (!newPresetName.trim() || !newPresetTitle.trim() || !newPresetLoc.trim()) return;
    set({ search_presets: [...draft.search_presets, { name: newPresetName.trim(), job_title: newPresetTitle.trim(), location: newPresetLoc.trim() }] });
    setNewPresetName(""); setNewPresetTitle(""); setNewPresetLoc("");
  };
  const removePreset  = (i: number)  => set({ search_presets:  draft.search_presets.filter((_, idx) => idx !== i) });
  const addSkill      = ()           => {
    const s = newSkill.trim();
    if (!s || draft.skills_blacklist.includes(s)) return;
    set({ skills_blacklist: [...draft.skills_blacklist, s] });
    setNewSkill("");
  };
  const removeSkill   = (s: string)  => set({ skills_blacklist: draft.skills_blacklist.filter(x => x !== s) });
  const updateColLabel = (id: string, label: string) =>
    set({ kanban_columns: draft.kanban_columns.map(c => c.id === id ? { ...c, label } : c) });
  const addColumn    = ()           => {
    const label = newColLabel.trim();
    if (!label) return;
    set({ kanban_columns: [...draft.kanban_columns, { id: "custom_" + Date.now(), label }] });
    setNewColLabel("");
  };
  const removeColumn  = (id: string) => set({ kanban_columns: draft.kanban_columns.filter(c => c.id !== id) });

  const isAlertsSection = section === "alerts" || section === "apikeys";

  return (
    <div className="settings-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="settings-head">
          <h2 className="settings-head-title">⚙️ Preferences</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="settings-tabs">
          {SECTIONS.map(s => (
            <button key={s.id} className={`settings-tab${section === s.id ? " active" : ""}`} onClick={() => setSection(s.id)}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        <div className="settings-body">

          {section === "search" && (
            <div className="settings-section">
              <p className="settings-section-desc">Default values pre-fill the Job Feed search on every visit.</p>
              <div className="settings-field">
                <label className="settings-label">Default Job Title</label>
                <input className="input" value={draft.default_job_title} onChange={e => set({ default_job_title: e.target.value })} placeholder="e.g. Machine Learning Engineer" />
              </div>
              <div className="settings-field">
                <label className="settings-label">Default Location</label>
                <input className="input" value={draft.default_location} onChange={e => set({ default_location: e.target.value })} placeholder="e.g. Bengaluru" />
              </div>
              <div className="settings-field">
                <label className="settings-label">Results per Search — <span style={{ color: "var(--green)" }}>{draft.result_count}</span></label>
                <input type="range" min={10} max={50} step={5} value={draft.result_count} onChange={e => set({ result_count: Number(e.target.value) })} className="settings-range" />
                <div className="settings-range-labels"><span>10</span><span>50</span></div>
              </div>
              <div className="settings-field">
                <label className="settings-label">Saved Search Presets</label>
                <p className="settings-field-hint">One-click to re-run a common search from the Job Feed.</p>
                {draft.search_presets.map((p, i) => (
                  <div key={i} className="preset-item">
                    <span className="preset-item-name">{p.name}</span>
                    <span className="preset-item-detail">{p.job_title} · {p.location}</span>
                    <button className="btn-remove-item" onClick={() => removePreset(i)}>✕</button>
                  </div>
                ))}
                <div className="alert-add-grid" style={{ marginTop: 8 }}>
                  <input className="input" placeholder="Preset name" value={newPresetName} onChange={e => setNewPresetName(e.target.value)} />
                  <input className="input" placeholder="Job title"   value={newPresetTitle} onChange={e => setNewPresetTitle(e.target.value)} />
                  <input className="input" placeholder="Location"    value={newPresetLoc} onChange={e => setNewPresetLoc(e.target.value)} />
                </div>
                <button className="btn-add-item" onClick={addPreset} style={{ marginTop: 8 }}>+ Add Preset</button>
              </div>
            </div>
          )}

          {section === "scoring" && (
            <div className="settings-section">
              <div className="settings-field">
                <label className="settings-label">Minimum Match Score — <span style={{ color: "var(--green)" }}>{draft.min_match_score}%</span></label>
                <p className="settings-field-hint">Jobs scoring below this threshold are hidden in the Job Feed.</p>
                <input type="range" min={0} max={90} step={5} value={draft.min_match_score} onChange={e => set({ min_match_score: Number(e.target.value) })} className="settings-range" />
                <div className="settings-range-labels"><span>0% (show all)</span><span>90%</span></div>
              </div>
              <div className="settings-field">
                <label className="settings-label">Auto-Score After Fetch</label>
                <p className="settings-field-hint">Automatically run AI scoring when new jobs are fetched.</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <button className={`toggle-btn${draft.auto_score ? " on" : ""}`} onClick={() => set({ auto_score: !draft.auto_score })}>
                    <span className="toggle-knob" />
                  </button>
                  <span style={{ color: "var(--t2)", fontSize: 14 }}>{draft.auto_score ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
              <div className="settings-field">
                <label className="settings-label">Skills to Exclude from Scoring</label>
                <p className="settings-field-hint">Skills you have but don't want matched — e.g. Java if you're pivoting away from it.</p>
                <div className="chip-list" style={{ marginTop: 8 }}>
                  {draft.skills_blacklist.map(s => (
                    <span key={s} className="key-badge">
                      {s} <button onClick={() => removeSkill(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", paddingLeft: 4 }}>✕</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input className="input" placeholder="Add a skill…" value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => e.key === "Enter" && addSkill()} style={{ flex: 1 }} />
                  <button className="btn-add-item" onClick={addSkill}>+ Add</button>
                </div>
              </div>
            </div>
          )}

          {section === "tracker" && (
            <div className="settings-section">
              <div className="settings-field">
                <label className="settings-label">Stale Application Alert — <span style={{ color: "var(--amber)" }}>{draft.stale_days === 0 ? "Disabled" : `${draft.stale_days} days`}</span></label>
                <p className="settings-field-hint">Kanban cards that haven't moved for this many days get an amber highlight. Set to 0 to disable.</p>
                <input type="range" min={0} max={30} step={1} value={draft.stale_days} onChange={e => set({ stale_days: Number(e.target.value) })} className="settings-range" />
                <div className="settings-range-labels"><span>0 (off)</span><span>30 days</span></div>
              </div>
              <div className="settings-field">
                <label className="settings-label">Kanban Columns</label>
                <p className="settings-field-hint">Rename existing columns or add custom stages.</p>
                {draft.kanban_columns.map(col => (
                  <div key={col.id} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <input className="input" value={col.label} onChange={e => updateColLabel(col.id, e.target.value)} style={{ flex: 1 }} />
                    {col.id.startsWith("custom_") && <button className="btn-remove-item" onClick={() => removeColumn(col.id)}>✕</button>}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input className="input" placeholder="New column name…" value={newColLabel} onChange={e => setNewColLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addColumn()} style={{ flex: 1 }} />
                  <button className="btn-add-item" onClick={addColumn}>+ Add Column</button>
                </div>
              </div>
            </div>
          )}

          {section === "dashboard" && (
            <div className="settings-section">
              <div className="settings-field">
                <label className="settings-label">Analytics Date Range</label>
                <p className="settings-field-hint">Limit dashboard metrics to applications updated within this window.</p>
                <div className="day-pills" style={{ marginTop: 12 }}>
                  {[0, 30, 60, 90].map(d => (
                    <button key={d} className={`day-pill${draft.dashboard_days === d ? " active" : ""}`} onClick={() => set({ dashboard_days: d })}>
                      {d === 0 ? "All time" : `Last ${d} days`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === "apikeys"  && <ApiKeysTab />}
          {section === "alerts"   && <ScheduledSearchesTab />}

          {!isAlertsSection && section !== "apikeys" && error   && <div className="banner banner-error" style={{ marginTop: 8 }}><span>⚠️</span><span>{error}</span></div>}
          {!isAlertsSection && section !== "apikeys" && success && <div className="banner banner-info"  style={{ marginTop: 8 }}><span>✓</span><span>Preferences saved successfully.</span></div>}
        </div>

        <div className="settings-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {!isAlertsSection && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Preferences"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
