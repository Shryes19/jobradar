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
  technical:         "⚙️ Technical",
  behavioral:        "🧠 Behavioral",
  company:           "🏢 Company",
  "problem-solving": "🔍 Problem-Solving",
  opener:            "👋 Opener",
};

const CAT_ORDER = ["opener", "behavioral", "technical", "company", "problem-solving"];

const S = {
  overlay:  { position:"fixed" as const, inset:0, background:"rgba(0,0,0,0.85)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" },
  modal:    { background:"#1e1b2e", border:"1px solid #3d3660", borderRadius:"16px", width:"100%", maxWidth:"760px", maxHeight:"88vh", display:"flex", flexDirection:"column" as const, boxShadow:"0 32px 80px rgba(0,0,0,0.8)", color:"#f0f0f5", overflow:"hidden" },
  head:     { display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid #3d3660", flexShrink:0 },
  body:     { flex:1, overflowY:"auto" as const, padding:"20px 24px" },
  foot:     { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 24px", borderTop:"1px solid #3d3660", flexShrink:0 },
  closeBtn: { background:"none", border:"none", color:"#a0a0c0", fontSize:"18px", cursor:"pointer", padding:"0 4px" },
  filterRow:{ display:"flex", flexWrap:"wrap" as const, gap:"6px", marginBottom:"16px" },
  qItem:    { background:"#141428", border:"1px solid #2d2a4a", borderRadius:"10px", marginBottom:"8px", overflow:"hidden" },
  qBtn:     { width:"100%", background:"none", border:"none", color:"#e0e0f0", cursor:"pointer", padding:"14px 16px", display:"flex", alignItems:"center", gap:"10px", textAlign:"left" as const, fontSize:"13.5px" },
  ansPanel: { padding:"0 16px 16px", borderTop:"1px solid #2d2a4a" },
  tip:      { background:"rgba(139,92,246,0.12)", border:"1px solid rgba(139,92,246,0.25)", borderRadius:"8px", padding:"10px 14px", marginTop:"12px", fontSize:"13px", color:"#c4b5fd", lineHeight:1.6 },
  sample:   { background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:"8px", padding:"10px 14px", marginTop:"10px", fontSize:"13px", color:"#6ee7b7", lineHeight:1.7 },
};

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
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.head}>
          <div>
            <h2 style={{margin:0, fontSize:"17px", fontWeight:800}}>🎤 Interview Prep</h2>
            {(jobTitle || companyName) && <p style={{margin:"4px 0 0", fontSize:"12.5px", color:"#a0a0c0"}}>{jobTitle}{companyName ? ` · ${companyName}` : ""}</p>}
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={S.body}>
          {loading && (
            <div style={{textAlign:"center", padding:"48px 0", color:"#a0a0c0"}}>
              <div style={{width:"32px", height:"32px", border:"3px solid #3d3660", borderTopColor:"#8b5cf6", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px"}} />
              <p style={{margin:0}}>Generating questions with AI…</p>
              <p style={{margin:"6px 0 0", fontSize:"12px", color:"#6060a0"}}>This takes 10–20 seconds</p>
            </div>
          )}
          {error && <div style={{background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:"8px", padding:"12px 16px", color:"#fca5a5"}}>⚠️ {error}</div>}

          {!loading && questions.length > 0 && (
            <>
              <div style={S.filterRow}>
                {cats.map(c => (
                  <button key={c} onClick={() => setActiveCat(c)} style={{padding:"5px 12px", background: activeCat===c ? "#7c3aed" : "#2d2a4a", border:"1px solid #3d3660", borderRadius:"20px", color: activeCat===c ? "#fff" : "#c0c0e0", cursor:"pointer", fontSize:"12.5px"}}>
                    {c === "all" ? `All (${questions.length})` : CAT_LABELS[c] || c}
                  </button>
                ))}
              </div>

              <div>
                {visible.map((q, i) => (
                  <div key={i} style={S.qItem}>
                    <button style={S.qBtn} onClick={() => toggle(i)}>
                      <span style={{background:"#7c3aed", color:"#fff", borderRadius:"6px", padding:"2px 7px", fontSize:"11px", fontWeight:700, flexShrink:0}}>Q{i+1}</span>
                      <span style={{fontSize:"11px", color:"#8b5cf6", flexShrink:0}}>{CAT_LABELS[q.category] || q.category}</span>
                      <span style={{flex:1, color:"#e0e0f0"}}>{q.question}</span>
                      <span style={{color:"#6060a0", fontSize:"11px"}}>{expanded.has(i) ? "▲" : "▼"}</span>
                    </button>
                    {expanded.has(i) && (
                      <div style={S.ansPanel}>
                        <div style={S.tip}><strong>💡 What they're looking for:</strong> {q.tip}</div>
                        {q.sample_answer && (
                          <div style={S.sample}>
                            <div style={{fontWeight:700, marginBottom:"6px"}}>✅ Model Answer</div>
                            <p style={{margin:0}}>{q.sample_answer}</p>
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

        <div style={S.foot}>
          <span style={{fontSize:"12px", color:"#6060a0"}}>{questions.length > 0 ? `${questions.length} questions with model answers` : ""}</span>
          <button onClick={onClose} style={{padding:"8px 20px", background:"#2d2a4a", border:"1px solid #3d3660", borderRadius:"8px", color:"#c0c0e0", cursor:"pointer", fontSize:"13px"}}>Close</button>
        </div>
      </div>
    </div>
  );
}
