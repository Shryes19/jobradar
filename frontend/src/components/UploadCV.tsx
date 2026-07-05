import { useCallback, useRef, useState } from "react";
import { uploadCV } from "../api";
import type { Profile } from "../api";

interface Props {
  profile: Profile | null;
  onProfileUpdate: (p: Profile) => void;
}

export default function UploadCV({ profile, onProfileUpdate }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [justDone, setJustDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted. Please choose a valid PDF.");
      return;
    }
    setError(null);
    setLoading(true);
    setJustDone(false);
    try {
      const result = await uploadCV(file);
      onProfileUpdate(result);
      setJustDone(true);
    } catch (e: any) {
      setError(e.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [onProfileUpdate]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="upload-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">
          {profile
            ? "Your CV is processed. Drop a new PDF anytime to refresh your profile."
            : "Upload your PDF resume to unlock AI-powered job matching."}
        </p>
      </div>

      {/* Hero banner — only for first-time users */}
      {!profile && !loading && (
        <div className="upload-hero">
          <span className="upload-hero-icon">🚀</span>
          <div>
            <h2>Start your AI-powered job search</h2>
            <p>
              Upload once. JobRadar scores every job listing against your unique skills and
              experience, generates cover letters, preps you for interviews, and tracks your
              entire application pipeline.
            </p>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`drop-zone${dragging ? " drag-over" : ""}${loading ? " loading-zone" : ""}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={onFileChange} />

        {loading ? (
          <div className="dz-loading">
            <div className="spinner" />
            <p>Parsing your CV with AI…</p>
            <span>Extracting skills, experience and profile data</span>
          </div>
        ) : (
          <>
            <span className="dz-icon">{profile ? "🔄" : "📄"}</span>
            <p className="dz-title">
              {profile ? "Drop a new PDF to update your profile" : "Drag & drop your CV here"}
            </p>
            <p className="dz-or">— or —</p>
            <button className="btn btn-primary" type="button" style={{ margin: "0 auto" }}>
              Browse File
            </button>
            <p className="dz-hint">PDF only · Max 10 MB</p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="banner banner-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Success nudge */}
      {justDone && (
        <div className="profile-next-step">
          <span>✅</span>
          <span>
            Profile updated! Head to <strong>Job Feed</strong> to search for matching jobs.
          </span>
        </div>
      )}

      {/* Profile card */}
      {profile && !loading && (
        <div className="profile-card">
          <div className="profile-card-stripe" />
          <div className="profile-card-body">
            <div className="profile-header">
              <div className="profile-avatar-lg">
                {profile.full_name ? profile.full_name[0].toUpperCase() : "?"}
              </div>
              <div>
                <div className="profile-name">{profile.full_name || "Unknown"}</div>
                <div className="profile-role">{profile.current_job_title || "—"}</div>
              </div>
            </div>

            <div className="profile-meta-grid">
              <div className="meta-pill">
                <div className="meta-pill-label">Experience</div>
                <div className="meta-pill-value green">{profile.years_of_experience || "—"}</div>
              </div>
              <div className="meta-pill">
                <div className="meta-pill-label">Skills Found</div>
                <div className="meta-pill-value amber">
                  {profile.technical_skills.length > 0 ? `${profile.technical_skills.length} skills` : "—"}
                </div>
              </div>
            </div>

            {profile.professional_summary && (
              <div>
                <div className="input-label" style={{ marginBottom: 8 }}>Professional Summary</div>
                <p className="profile-summary-text">{profile.professional_summary}</p>
              </div>
            )}

            {profile.technical_skills.length > 0 && (
              <div>
                <div className="input-label" style={{ marginBottom: 8 }}>Technical Skills</div>
                <div className="skills-wrap">
                  {profile.technical_skills.map(skill => (
                    <span key={skill} className="chip">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            <p className="profile-updated-ts">
              Last updated: {new Date(profile.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* How it works — only when no profile yet */}
      {!profile && !loading && (
        <div className="how-strip">
          <p className="how-strip-title">What happens after you upload?</p>
          <div className="how-strip-steps">
            {[
              { icon: "🔎", title: "AI Parses CV",      desc: "Skills and experience extracted automatically." },
              { icon: "🔍", title: "Search Live Jobs",   desc: "LinkedIn & Indeed pulled in real-time." },
              { icon: "🎯", title: "Get Match Scores",   desc: "Every job scored 0–100% against your CV." },
              { icon: "📋", title: "Track Everything",   desc: "Kanban pipeline for your applications." },
            ].map((s, i) => (
              <div key={i} className="how-step">
                <div className="how-step-num-icon">{s.icon}</div>
                <span className="how-step-title">{s.title}</span>
                <span className="how-step-desc">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
