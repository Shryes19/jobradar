import { useEffect, useState } from "react";
import { generateCoverLetter } from "../api";

interface Props {
  jobId: number;
  jobTitle: string | null;
  companyName: string | null;
  onClose: () => void;
}

export default function CoverLetterModal({ jobId, jobTitle, companyName, onClose }: Props) {
  const [text,    setText]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    generateCoverLetter(jobId)
      .then(r => setText(r.cover_letter))
      .catch(e => setError(e.message || "Failed to generate cover letter."))
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!text) return;
    const filename = `cover-letter-${(companyName || "company").replace(/\s+/g, "-").toLowerCase()}.txt`;
    const blob = new Blob([text], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2 className="modal-title">✉ Cover Letter</h2>
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
              <p>Generating cover letter with AI…</p>
              <p className="modal-loading-hint">This takes 5–10 seconds</p>
            </div>
          )}
          {error && <div className="banner banner-error"><span>⚠️</span><span>{error}</span></div>}
          {text && (
            <textarea
              className="modal-textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={22}
              spellCheck
            />
          )}
        </div>

        {text && (
          <div className="modal-foot">
            <button className="btn btn-secondary" onClick={handleCopy}>
              {copied ? "✓ Copied!" : "Copy to Clipboard"}
            </button>
            <button className="btn btn-primary" onClick={handleDownload}>
              Download .txt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
