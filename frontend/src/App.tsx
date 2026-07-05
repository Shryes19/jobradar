import { createContext, useCallback, useContext, useEffect, useState } from "react";
import UploadCV from "./components/UploadCV";
import JobFeed from "./components/JobFeed";
import Tracker from "./components/Tracker";
import Dashboard from "./components/Dashboard";
import Settings from "./components/Settings";
import AuthModal from "./components/AuthModal";
import { getProfile, getUserSettings, updateUserSettings, getMe, clearToken, DEFAULT_USER_SETTINGS } from "./api";
import type { Profile, UserSettings, AuthUser } from "./api";
import "./App.css";

/* ── Toast system ─────────────────────────────────────────────── */
type ToastType = "success" | "error" | "info";
interface Toast { id: number; type: ToastType; message: string; }

interface ToastCtx { addToast: (msg: string, type?: ToastType) => void; }
export const ToastContext = createContext<ToastCtx>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

let _toastId = 0;

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const ICON: Record<ToastType, string> = { success: "✓", error: "✕", info: "ℹ" };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">{ICON[t.type]}</span>
            <span>{t.message}</span>
            <button className="toast-dismiss" onClick={() => remove(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ── Types ────────────────────────────────────────────────────── */
type Tab = "upload" | "feed" | "tracker" | "dashboard";

const TABS: { id: Tab; label: string; icon: string; hint: string }[] = [
  { id: "upload",    label: "My Profile", icon: "👤", hint: "Upload CV & view profile" },
  { id: "feed",      label: "Job Feed",   icon: "🔍", hint: "Search & score live jobs" },
  { id: "tracker",   label: "Tracker",    icon: "📋", hint: "Manage your pipeline" },
  { id: "dashboard", label: "Analytics",  icon: "📊", hint: "Track your progress" },
];

/* ── Landing page ─────────────────────────────────────────────── */
function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="landing">
      <div className="landing-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="landing-content">
        <div className="landing-pill">
          <span className="pill-dot" />
          AI-Powered · Free · Multi-User
        </div>

        <h1 className="landing-h1">
          Your <span className="grad">Smartest</span><br />Job Search, Ever.
        </h1>

        <p className="landing-sub">
          Upload your CV once. JobRadar searches LinkedIn & Indeed, scores every
          job against your profile with AI, and tracks your entire application
          pipeline — all in one place.
        </p>

        <div className="landing-actions">
          <button className="btn-hero btn-hero-primary" onClick={onStart}>
            Get Started Free &rarr;
          </button>
          <button className="btn-hero btn-hero-ghost" onClick={onStart}>
            Sign In
          </button>
        </div>

        <div className="landing-stats">
          <div className="stat-item">
            <span className="stat-num green">AI</span>
            <span className="stat-lbl">Match Scoring</span>
          </div>
          <div className="stat-item">
            <span className="stat-num">2</span>
            <span className="stat-lbl">Platforms</span>
          </div>
          <div className="stat-item">
            <span className="stat-num violet">6</span>
            <span className="stat-lbl">Pipeline Stages</span>
          </div>
          <div className="stat-item">
            <span className="stat-num cyan">∞</span>
            <span className="stat-lbl">Jobs Tracked</span>
          </div>
        </div>

        <p className="section-eyebrow">How it works — 4 simple steps</p>
        <div className="steps-grid">
          {[
            { n: "01", icon: "📄", title: "Upload Your CV", desc: "Drop your PDF and AI extracts your skills, experience, and profile instantly." },
            { n: "02", icon: "🔍", title: "Search Live Jobs", desc: "Enter a role and city. Pull live listings from LinkedIn and Indeed right now." },
            { n: "03", icon: "🎯", title: "AI Scores Matches", desc: "Every job gets a 0–100% match score based on how well it fits your CV." },
            { n: "04", icon: "📋", title: "Track & Improve", desc: "Manage your pipeline, get interview prep, and analyze your search data." },
          ].map(s => (
            <div key={s.n} className="step-card">
              <span className="step-n">STEP {s.n}</span>
              <span className="step-icon">{s.icon}</span>
              <span className="step-title">{s.title}</span>
              <span className="step-desc">{s.desc}</span>
            </div>
          ))}
        </div>

        <p className="section-eyebrow" style={{ marginTop: 48 }}>Everything you need to land the role</p>
        <div className="features-grid">
          {[
            { icon: "🤖", title: "AI Cover Letters",    desc: "Generate a tailored cover letter for any job in seconds using your CV." },
            { icon: "💰", title: "Salary Estimates",    desc: "Get AI-powered salary range estimates before you even apply." },
            { icon: "🎤", title: "Interview Prep",      desc: "Role-specific questions and coaching tips for every job." },
            { icon: "🏢", title: "Company Briefs",      desc: "Instant AI summaries — culture, size, mission — before applying." },
            { icon: "⏰", title: "Automated Alerts",    desc: "Schedule searches and get notified when new matching jobs appear." },
            { icon: "📈", title: "Rejection Analysis",  desc: "Understand patterns in your applications and close skill gaps." },
          ].map(f => (
            <div key={f.title} className="feat-card">
              <span className="feat-icon">{f.icon}</span>
              <span className="feat-title">{f.title}</span>
              <span className="feat-desc">{f.desc}</span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 52 }}>
          <button className="btn-hero btn-hero-primary" onClick={onStart}>
            Get Started Free &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main app ─────────────────────────────────────────────────── */
function AppShell() {
  const [tab, setTab]           = useState<Tab>("upload");
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showLanding, setShowLanding]   = useState(false);
  const [ready, setReady]               = useState(false);
  const [authUser, setAuthUser]         = useState<AuthUser | null>(null);
  const [showAuth, setShowAuth]         = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const { addToast } = useToast();

  // Boot: check token → load user/profile/settings
  useEffect(() => {
    async function boot() {
      const me = await getMe();
      if (!me) {
        setShowAuth(true);
        setReady(true);
        return;
      }
      setAuthUser(me);
      const [p, s] = await Promise.all([
        getProfile().catch(() => null),
        getUserSettings().catch(() => DEFAULT_USER_SETTINGS),
      ]);
      setProfile(p);
      setSettings(s ?? DEFAULT_USER_SETTINGS);
      setShowLanding(!p);
      setReady(true);
    }
    boot();
  }, []);

  // Listen for auto-logout (401 from any API call)
  useEffect(() => {
    function onLogout() {
      setAuthUser(null);
      setProfile(null);
      setSettings(DEFAULT_USER_SETTINGS);
      setShowAuth(true);
      setReady(true);
    }
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  function handleAuth(user: AuthUser) {
    setAuthUser(user);
    setShowAuth(false);
    // Load profile + settings for newly authenticated user
    Promise.all([
      getProfile().catch(() => null),
      getUserSettings().catch(() => DEFAULT_USER_SETTINGS),
    ]).then(([p, s]) => {
      setProfile(p);
      setSettings(s ?? DEFAULT_USER_SETTINGS);
      setShowLanding(!p);
    });
  }

  function handleLogout() {
    clearToken();
    setAuthUser(null);
    setProfile(null);
    setSettings(DEFAULT_USER_SETTINGS);
    setShowAuth(true);
    setShowLanding(false);
  }

  if (!ready) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading JobRadar…</p>
      </div>
    );
  }

  if (showAuth) {
    return (
      <div className="app">
        <header className="navbar">
          <div className="navbar-brand">
            <div className="brand-logo">🎯</div>
            <span className="brand-name">JobRadar</span>
          </div>
        </header>
        <AuthModal onAuth={handleAuth} />
      </div>
    );
  }

  if (showLanding) {
    return (
      <div className="app">
        <header className="navbar">
          <div className="navbar-brand">
            <div className="brand-logo">🎯</div>
            <span className="brand-name">JobRadar</span>
          </div>
          <div className="navbar-right">
            <button className="btn btn-primary btn-sm" onClick={() => setShowLanding(false)}>
              Get Started →
            </button>
            {authUser && (
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Sign Out
              </button>
            )}
          </div>
        </header>
        <Landing onStart={() => setShowLanding(false)} />
      </div>
    );
  }

  const displayName = profile?.full_name || authUser?.full_name || authUser?.email || "User";
  const avatarChar = displayName[0]?.toUpperCase() ?? "U";

  return (
    <div className="app">
      <header className="navbar">
        <div className="navbar-brand" onClick={() => { setShowLanding(true); setMenuOpen(false); }} style={{ cursor: "pointer" }}>
          <div className="brand-logo">🎯</div>
          <span className="brand-name">JobRadar</span>
          <span className="brand-version">Beta</span>
        </div>

        {/* Desktop nav */}
        <nav className="nav-links nav-links-desktop">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              className={`nav-link ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              title={t.hint}
            >
              <span className="nav-link-icon">{t.icon}</span>
              {t.label}
              {i === 0 && profile && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="navbar-right">
          {/* Desktop: user chip + settings + sign out */}
          <div className="user-chip nav-desktop-only">
            <div className="user-avatar">{avatarChar}</div>
            <span className="user-name">{displayName}</span>
          </div>
          <button className="btn-icon nav-desktop-only" onClick={() => setShowSettings(true)} title="Settings">⚙</button>
          <button className="btn btn-ghost btn-sm nav-desktop-only" onClick={handleLogout} title="Sign out">
            Sign Out
          </button>

          {/* Mobile: hamburger */}
          <button
            className={`btn-hamburger nav-mobile-only${menuOpen ? " open" : ""}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="mobile-menu" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu-inner" onClick={e => e.stopPropagation()}>
            {/* User identity */}
            <div className="mobile-menu-user">
              <div className="user-avatar mobile-avatar">{avatarChar}</div>
              <div>
                <div className="mobile-user-name">{displayName}</div>
                <div className="mobile-user-email">{authUser?.email ?? ""}</div>
              </div>
            </div>

            <div className="mobile-menu-divider" />

            {/* Nav items */}
            {TABS.map((t, i) => (
              <button
                key={t.id}
                className={`mobile-nav-item${tab === t.id ? " active" : ""}`}
                onClick={() => { setTab(t.id); setMenuOpen(false); }}
              >
                <span className="mobile-nav-icon">{t.icon}</span>
                <span className="mobile-nav-label">{t.label}</span>
                {i === 0 && profile && <span className="nav-dot" style={{ marginLeft: "auto" }} />}
                {tab === t.id && <span className="mobile-nav-check">✓</span>}
              </button>
            ))}

            <div className="mobile-menu-divider" />

            {/* Settings + Sign out */}
            <button className="mobile-nav-item" onClick={() => { setShowSettings(true); setMenuOpen(false); }}>
              <span className="mobile-nav-icon">⚙</span>
              <span className="mobile-nav-label">Settings</span>
            </button>
            <button className="mobile-nav-item mobile-nav-danger" onClick={() => { handleLogout(); setMenuOpen(false); }}>
              <span className="mobile-nav-icon">↩</span>
              <span className="mobile-nav-label">Sign Out</span>
            </button>
          </div>
        </div>
      )}


      <main className={tab === "tracker" ? "page page-wide" : "page"}>
        {tab === "upload" && (
          <UploadCV
            profile={profile}
            onProfileUpdate={p => { setProfile(p); addToast("Profile updated successfully!"); }}
          />
        )}
        {tab === "feed" && (
          <JobFeed profile={profile} settings={settings} />
        )}
        {tab === "tracker" && (
          <Tracker settings={settings} />
        )}
        {tab === "dashboard" && (
          <Dashboard
            settings={settings}
            onSettingChange={(key, val) => {
              const updated = { ...settings, [key]: val } as UserSettings;
              setSettings(updated);
              updateUserSettings(updated).catch(() => {});
            }}
          />
        )}
      </main>

      {showSettings && (
        <Settings
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSaved={s => { setSettings(s); setShowSettings(false); addToast("Settings saved!"); }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
