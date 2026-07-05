import { useEffect, useState } from "react";
import { getInterviewPrep } from "../api";
import type { InterviewQuestion } from "../api";

interface PrepQuestion extends InterviewQuestion {
  sample_answer?: string;
}

interface Props {
  jobId: number;
  jobTitle: string | null;
  companyName: string | null;
  onClose: () => void;
}

const CAT_LABELS: Record<string, string> = {
  technical:       "⚙️ Technical",
  behavioral:      "🧠 Behavioral",
  company:         "🏢 Company",
  "problem-solving": "🔍 Problem-Solving",
  opener:          "👋 Opener",
};

const CAT_ORDER = ["opener", "behavioral", "technical", "company", "problem-solving"];

export default function InterviewPrepModal({ jobId, jobTitle, companyName, onClose }: Props) {
  const [questions, setQuestions] = useState<PrepQuestion[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<Set<number>>(new Set());
  const [activeCat, setActiveCat] = useState<string>("all");

  useEffect(() => {
    setQuestions([]);
    setError(null);
    setLoading(true);
    getInterviewPrep(jobId)
      .then(r => setQuestions(r.questions as PrepQuestion[]))
      .catch(e => setError(e.message || "Failed to generate questions."))
      .finally(() => setLoading(false));
  }, [jobId]);

  const toggle = (i: number) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const cats    = ["all", ...CAT_ORDER.filter(c => questions.some(q => q.category === c))];
  const visible = activeCat === "all" ? questions : questions.filter(q => q.category === activeCat);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{background:"#1e1b2e", color:"#f0f0f5"}}>
        <div className="modal-head">
          <div>
            <h2 className="modal-title">🎤 Interview Prep</h2>
            {(jobTitle || companyName) && (
              <p className="modal-sub">{jobTitle || "Role"}{companyName ? ` · ${companyName}` : ""}</p>
            )}
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="modal-loading">
              <div className="spinner" />
              <p>Generating questions and model answers with AI…</p>
              <p className="modal-loading-hint">This takes 10–20 seconds</p>
            </div>
          )}
          {error && <div className="banner banner-error"><span>⚠️</span><span>{error}</span></div>}

          {!loading && questions.length > 0 && (
            <>
              <div className="prep-filter-row">
                {cats.map(c => (
                  <button
                    key={c}
                    className={`prep-filter-btn${activeCat === c ? " active" : ""}`}
                    onClick={() => setActiveCat(c)}
                  >
                    {c === "all" ? `All (${questions.length})` : CAT_LABELS[c] || c}
                  </button>
                ))}
              </div>

              <div className="prep-q-list">
                {visible.map((q, i) => (
                  <div key={i} className={`prep-q-item${expanded.has(i) ? " open" : ""}`}>
                    <button className="prep-q-btn" onClick={() => toggle(i)}>
                      <span className="prep-q-num">Q{i + 1}</span>
                      <span className="prep-q-cat">{CAT_LABELS[q.category] || q.category}</span>
                      <span className="prep-q-text">{q.question}</span>
                      <span className="prep-q-chev">{expanded.has(i) ? "▲" : "▼"}</span>
                    </button>

                    {expanded.has(i) && (
                      <div className="prep-answer-panel">
                        {/* Tip */}
                        <div className="prep-q-tip">
                          <span className="prep-tip-lbl">💡 What they're looking for: </span>
                          {q.tip}
                        </div>

                        {/* Sample answer */}
                        {q.sample_answer && (
                          <div className="prep-sample-answer">
                            <div className="prep-sample-lbl">✅ Model Answer</div>
                            <p className="prep-sample-text">{q.sample_answer}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <span className="modal-foot-info">
            {questions.length > 0 && `${questions.length} questions with model answers`}
          </span>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
