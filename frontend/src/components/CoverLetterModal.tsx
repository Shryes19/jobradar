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
    setText(null);
    setError(null);
    setLoading(true);
    generateCoverLetter(jobId)
      .then(r => setText(r.cover_letter || "(empty response from AI)"))
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

  const openInNewTab = () => {
    if (!text) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cover Letter – ${companyName || "Company"}</title>
    <style>body{font-family:Georgia,serif;max-width:720px;margin:60px auto;padding:0 24px;line-height:1.8;color:#1a1a1a;font-size:16px;}
    h1{font-size:18px;margin-bottom:32px;color:#444;}pre{white-space:pre-wrap;word-wrap:break-word;}</style></head>
    <body><h1>Cover Letter — ${jobTitle || "Role"} at ${companyName || "Company"}</h1><pre>${text.replace(/</g,"&lt;")}</pre></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{background:"#1e1b2e",border:"1px solid #3d3660",borderRadius:"16px",width:"100%",maxWidth:"660px",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 32px 80px rgba(0,0,0,0.8)",color:"#f0f0f5",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"20px 24px 16px",borderBottom:"1px solid #3d3660",flexShrink:0}}>
          <div>
            <h2 style={{margin:0,fontSize:"17px",fontWeight:800}}>✉ Cover Letter</h2>
            {(jobTitle || companyName) && <p style={{margin:"4px 0 0",fontSize:"12.5px",color:"#a0a0c0"}}>{jobTitle}{companyName ? ` · ${companyName}` : ""}</p>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#a0a0c0",fontSize:"18px",cursor:"pointer",padding:"0 4px"}}>✕</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
          {loading && (
            <div style={{textAlign:"center",padding:"48px 0",color:"#a0a0c0"}}>
              <div style={{width:"32px",height:"32px",border:"3px solid #3d3660",borderTopColor:"#8b5cf6",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}} />
              <p style={{margin:0}}>Generating cover letter with AI…</p>
              <p style={{margin:"6px 0 0",fontSize:"12px",color:"#6060a0"}}>This takes 5–10 seconds</p>
            </div>
          )}
          {error && <div style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:"8px",padding:"12px 16px",color:"#fca5a5"}}>⚠️ {error}</div>}
          {text && (
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={20}
              spellCheck
              style={{width:"100%",background:"#141428",border:"1px solid #3d3660",borderRadius:"8px",color:"#e8e8f0",fontSize:"13px",lineHeight:"1.75",padding:"14px",resize:"vertical",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}
            />
          )}
        </div>

        {text && (
          <div style={{display:"flex",gap:"8px",justifyContent:"flex-end",padding:"14px 24px",borderTop:"1px solid #3d3660",flexShrink:0}}>
            <button onClick={openInNewTab} style={{padding:"8px 14px",background:"#2d2a4a",border:"1px solid #3d3660",borderRadius:"8px",color:"#c0c0e0",cursor:"pointer",fontSize:"13px"}}>Open in Tab</button>
            <button onClick={handleCopy} style={{padding:"8px 14px",background:"#2d2a4a",border:"1px solid #3d3660",borderRadius:"8px",color:"#c0c0e0",cursor:"pointer",fontSize:"13px"}}>{copied ? "✓ Copied!" : "Copy"}</button>
            <button onClick={handleDownload} style={{padding:"8px 16px",background:"#7c3aed",border:"none",borderRadius:"8px",color:"#fff",cursor:"pointer",fontSize:"13px",fontWeight:600}}>Download .txt</button>
          </div>
        )}
      </div>
    </div>
  );
}
