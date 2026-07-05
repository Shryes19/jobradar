import json as _json
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job, Profile, User
from ..auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/skill-gaps")
async def get_skill_gaps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from groq import Groq
    from ..config import settings as cfg

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No CV profile found. Upload your CV first.")

    targeted_jobs = (
        db.query(Job)
        .filter(Job.user_id == current_user.id, Job.status.isnot(None), Job.job_description.isnot(None))
        .order_by(Job.created_at.desc())
        .limit(15)
        .all()
    )
    if not targeted_jobs:
        return {"gaps": [], "message": "Apply to some jobs first so we can identify skill gaps."}

    if not cfg.groq_api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured.")

    skills_text = ", ".join(profile.technical_skills) if profile.technical_skills else "N/A"
    jd_text = "\n---\n".join(
        f"[{j.job_title} at {j.company_name}]\n{(j.job_description or '')[:600]}"
        for j in targeted_jobs
    )

    prompt = f"""Analyze these job descriptions against the candidate's skills to identify gaps.

CANDIDATE SKILLS: {skills_text}

JOB DESCRIPTIONS (roles they are targeting):
{jd_text}

Identify the top 8 skills that appear in these job descriptions but are missing or weak in the candidate profile.
Rank by how frequently they appear across the job descriptions.

IMPORTANT: Return ONLY valid JSON. Use double quotes. Do not use apostrophes inside strings.
Return ONLY a JSON array, no other text:
[{{"skill": "...", "frequency": <number 1-{len(targeted_jobs)}>, "importance": "high|medium|low", "context": "<1 sentence why this matters for these roles>"}}]"""

    def _call():
        client = Groq(api_key=cfg.groq_api_key)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800,
        )
        return resp.choices[0].message.content.strip()

    try:
        loop = asyncio.get_running_loop()
        raw = await loop.run_in_executor(None, _call)
        start = raw.find("[")
        end = raw.rfind("]") + 1
        json_str = raw[start:end] if start >= 0 else "[]"
        try:
            gaps = _json.loads(json_str)
        except _json.JSONDecodeError:
            import re as _re
            cleaned = _re.sub(r'[\x00-\x1f\x7f]', ' ', json_str)
            try:
                gaps = _json.loads(cleaned)
            except Exception:
                gaps = []
        return {"gaps": gaps, "analyzed_jobs": len(targeted_jobs)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not analyze skill gaps: {str(e)}")


@router.get("/rejection-patterns")
def get_rejection_patterns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rejected = db.query(Job).filter(Job.user_id == current_user.id, Job.status == "rejected").all()
    all_tracked = db.query(Job).filter(Job.user_id == current_user.id, Job.status.isnot(None), Job.status != "saved").all()

    if not rejected:
        return {
            "rejection_rate": 0,
            "total_rejected": 0,
            "avg_rejected_score": None,
            "avg_accepted_score": None,
            "score_gap": None,
            "top_rejecting_companies": [],
            "message": "No rejections recorded yet — keep applying!",
        }

    rejection_rate = round(len(rejected) / len(all_tracked) * 100, 1) if all_tracked else 0

    scored_rejected = [j for j in rejected if j.match_score is not None]
    avg_rejected_score = (
        round(sum(j.match_score for j in scored_rejected) / len(scored_rejected), 1)
        if scored_rejected else None
    )

    progressed = [
        j for j in all_tracked
        if j.status in ("screening", "technical_interview", "offer") and j.match_score is not None
    ]
    avg_accepted_score = (
        round(sum(j.match_score for j in progressed) / len(progressed), 1)
        if progressed else None
    )

    score_gap = None
    if avg_rejected_score is not None and avg_accepted_score is not None:
        score_gap = round(avg_accepted_score - avg_rejected_score, 1)

    company_counts: dict[str, int] = {}
    for j in rejected:
        co = j.company_name or "Unknown"
        company_counts[co] = company_counts.get(co, 0) + 1
    top_companies = sorted(company_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    score_buckets = {"0-39": 0, "40-59": 0, "60-79": 0, "80+": 0, "unscored": 0}
    for j in rejected:
        if j.match_score is None:
            score_buckets["unscored"] += 1
        elif j.match_score < 40:
            score_buckets["0-39"] += 1
        elif j.match_score < 60:
            score_buckets["40-59"] += 1
        elif j.match_score < 80:
            score_buckets["60-79"] += 1
        else:
            score_buckets["80+"] += 1

    return {
        "rejection_rate": rejection_rate,
        "total_rejected": len(rejected),
        "avg_rejected_score": avg_rejected_score,
        "avg_accepted_score": avg_accepted_score,
        "score_gap": score_gap,
        "top_rejecting_companies": [{"company": c, "count": n} for c, n in top_companies],
        "score_distribution": score_buckets,
    }
