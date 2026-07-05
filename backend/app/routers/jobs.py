import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job, Profile, User
from ..schemas import JobResponse, FetchJobsRequest, ScoreRequest, JobScoreResult, StatusUpdate, VALID_STATUSES, AnalyticsResponse, FunnelStage, NotesUpdate, FollowUpUpdate, SalaryUpdate
from ..apify_service import fetch_linkedin_jobs, normalize_job, fetch_indeed_jobs, normalize_indeed_job
from ..scoring_service import score_jobs_parallel
from ..auth import get_current_user

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _to_response(j: Job) -> JobResponse:
    return JobResponse(
        id=j.id,
        job_title=j.job_title,
        company_name=j.company_name,
        location=j.location,
        job_description=j.job_description,
        linkedin_url=j.linkedin_url,
        platform=getattr(j, "platform", "linkedin"),
        match_score=j.match_score,
        status=j.status,
        status_updated_at=j.status_updated_at,
        notes=j.notes,
        follow_up_date=j.follow_up_date,
        salary_min=getattr(j, "salary_min", None),
        salary_max=getattr(j, "salary_max", None),
        salary_currency=getattr(j, "salary_currency", None),
        salary_note=getattr(j, "salary_note", None),
        created_at=j.created_at,
    )


ABBREVIATIONS = {
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "nlp": "natural language processing",
    "cv": "computer vision",
    "dl": "deep learning",
    "swe": "software engineer",
    "sde": "software development engineer",
    "ds": "data science",
}

def _expand(text: str) -> str:
    t = text.lower()
    for abbr, full in ABBREVIATIONS.items():
        t = t.replace(abbr, full)
    return t


def _title_matches(job_title: str, search_query: str) -> bool:
    if not job_title:
        return False
    title_expanded = _expand(job_title)
    query_expanded = _expand(search_query)
    keywords = [w for w in query_expanded.split() if len(w) > 2]
    if not keywords:
        return True
    matches = sum(1 for kw in keywords if kw in title_expanded)
    return matches >= max(1, len(keywords) // 2)


@router.post("/fetch", response_model=list[JobResponse])
async def fetch_jobs(
    body: FetchJobsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.job_title.strip() or not body.location.strip():
        raise HTTPException(status_code=400, detail="Job title and location are required.")

    platform = (body.platform or "linkedin").lower()

    try:
        if platform == "indeed":
            raw_jobs = await fetch_indeed_jobs(body.job_title, body.location, body.count)
            normalizer = normalize_indeed_job
        else:
            raw_jobs = await fetch_linkedin_jobs(body.job_title, body.location, body.count)
            normalizer = normalize_job
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch jobs: {str(e)}")

    if not raw_jobs:
        raise HTTPException(status_code=404, detail="No jobs found. Try different keywords or a broader location.")

    saved = []
    for raw in raw_jobs:
        normalized = normalizer(raw)
        if not normalized["job_title"] and not normalized["company_name"]:
            continue
        if not _title_matches(normalized["job_title"], body.job_title):
            continue

        job_url = normalized.get("linkedin_url", "")
        existing = None
        if job_url:
            existing = db.query(Job).filter(Job.user_id == current_user.id, Job.linkedin_url == job_url).first()

        if existing:
            saved.append(existing)
        else:
            job = Job(**normalized, platform=platform, user_id=current_user.id)
            db.add(job)
            try:
                db.commit()
                db.refresh(job)
                saved.append(job)
            except Exception:
                db.rollback()

    if not saved:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No jobs matching '{body.job_title}' were found in {body.location}. "
                "Try broader keywords (e.g. 'Machine Learning' instead of 'ML Researcher')."
            ),
        )

    return [_to_response(j) for j in saved]


@router.post("/score", response_model=list[JobScoreResult])
async def score_jobs(
    body: ScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.job_ids:
        raise HTTPException(status_code=400, detail="No job IDs provided.")

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No CV profile found. Upload your CV first.")

    jobs_to_score = []
    cached_results = []

    for job_id in body.job_ids:
        job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
        if not job:
            continue
        if job.match_score is not None and job.scored_profile_id == profile.id:
            cached_results.append(JobScoreResult(job_id=job.id, score=job.match_score))
        else:
            jobs_to_score.append(job)

    fresh_results = []
    if jobs_to_score:
        try:
            scores = await score_jobs_parallel(profile, jobs_to_score, body.skills_blacklist)
        except EnvironmentError as e:
            raise HTTPException(status_code=503, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Scoring failed: {str(e)}")

        for job in jobs_to_score:
            score = scores.get(job.id)
            if score is not None and score >= 0:
                job.match_score = score
                job.scored_profile_id = profile.id
                try:
                    db.commit()
                except Exception:
                    db.rollback()
                fresh_results.append(JobScoreResult(job_id=job.id, score=score))
            else:
                fresh_results.append(JobScoreResult(job_id=job.id, score=None, error="Scoring failed for this job."))

    return cached_results + fresh_results


@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(
    days: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    BEYOND_APPLIED = {"screening", "technical_interview", "offer", "rejected"}
    FUNNEL_STAGES = [
        ("saved",               "Saved"),
        ("applied",             "Applied"),
        ("screening",           "Screening"),
        ("technical_interview", "Technical Interview"),
        ("offer",               "Offer"),
        ("rejected",            "Rejected"),
    ]

    query = db.query(Job).filter(Job.user_id == current_user.id, Job.status.isnot(None))
    if days > 0:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.filter(Job.status_updated_at >= since)
    all_tracked = query.all()

    applications = [j for j in all_tracked if j.status != "saved"]
    total = len(applications)

    beyond = sum(1 for j in applications if j.status in BEYOND_APPLIED)
    response_rate = (beyond / total * 100) if total > 0 else None

    scored_jobs = [j for j in all_tracked if j.match_score is not None]
    avg_score: Optional[float] = None
    if scored_jobs:
        avg_score = sum(j.match_score for j in scored_jobs) / len(scored_jobs)

    status_counts: dict[str, int] = {}
    for j in all_tracked:
        status_counts[j.status] = status_counts.get(j.status, 0) + 1

    funnel = [
        FunnelStage(stage=stage, label=label, count=status_counts.get(stage, 0))
        for stage, label in FUNNEL_STAGES
    ]

    return AnalyticsResponse(
        total_applications=total,
        response_rate=response_rate,
        average_match_score=avg_score,
        funnel=funnel,
    )


@router.get("/tracker", response_model=list[JobResponse])
def get_tracker_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jobs = db.query(Job).filter(Job.user_id == current_user.id, Job.status.isnot(None)).order_by(Job.status_updated_at.desc()).all()
    return [_to_response(j) for j in jobs]


@router.patch("/{job_id}/status", response_model=JobResponse)
def update_status(
    job_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.status or not body.status.strip():
        raise HTTPException(status_code=400, detail="Status cannot be empty.")
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    job.status = body.status
    job.status_updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(job)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update job status.")
    return _to_response(job)


@router.get("/", response_model=list[JobResponse])
def get_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jobs = db.query(Job).filter(Job.user_id == current_user.id).order_by(Job.created_at.desc()).all()
    return [_to_response(j) for j in jobs]


@router.delete("/{job_id}", status_code=204)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    db.delete(job)
    db.commit()


@router.post("/{job_id}/cover-letter")
async def generate_cover_letter(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from groq import Groq
    from ..config import settings as cfg

    if not cfg.groq_api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured.")

    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No CV profile found. Upload your CV first.")

    skills = ", ".join(profile.technical_skills[:20]) if profile.technical_skills else "N/A"

    prompt = f"""Write a professional, tailored cover letter for the following candidate applying to the job below.

CANDIDATE PROFILE:
Name: {profile.full_name or "The Candidate"}
Current Title: {profile.current_job_title or "N/A"}
Experience: {profile.years_of_experience or "N/A"}
Key Skills: {skills}
Summary: {profile.professional_summary or "N/A"}

JOB DETAILS:
Title: {job.job_title or "N/A"}
Company: {job.company_name or "N/A"}
Description:
{(job.job_description or "")[:3000]}

INSTRUCTIONS:
- Write 3 focused paragraphs (opening, why this role + skills match, closing with call to action)
- Be specific — reference the company name and role title by name
- Match specific skills from the candidate profile to specific requirements in the job description
- Professional, confident, and concise tone
- Do NOT use generic filler phrases like "I am writing to express my interest"
- Output only the cover letter text, no subject line, no "Dear Hiring Manager" header needed, start directly with the opening paragraph"""

    import asyncio
    def _call():
        client = Groq(api_key=cfg.groq_api_key)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1024,
        )
        return resp.choices[0].message.content.strip()

    try:
        loop = asyncio.get_running_loop()
        text = await loop.run_in_executor(None, _call)
        return {"cover_letter": text, "job_title": job.job_title, "company_name": job.company_name}
    except Exception as e:
        logger.exception("Cover letter generation failed")
        raise HTTPException(status_code=502, detail=f"Could not generate cover letter: {str(e)}")


@router.patch("/{job_id}/notes", response_model=JobResponse)
def update_notes(
    job_id: int,
    body: NotesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    job.notes = body.notes.strip() or None
    db.commit()
    db.refresh(job)
    return _to_response(job)


@router.patch("/{job_id}/follow-up", response_model=JobResponse)
def update_follow_up(
    job_id: int,
    body: FollowUpUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    job.follow_up_date = body.follow_up_date
    db.commit()
    db.refresh(job)
    return _to_response(job)


@router.patch("/{job_id}/salary", response_model=JobResponse)
def update_salary(
    job_id: int,
    body: SalaryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    job.salary_min = body.salary_min
    job.salary_max = body.salary_max
    job.salary_currency = body.salary_currency
    job.salary_note = body.salary_note
    db.commit()
    db.refresh(job)
    return _to_response(job)


def _groq_call(prompt: str, model: str = "llama-3.3-70b-versatile", temperature: float = 0.7, max_tokens: int = 1024) -> str:
    from groq import Groq
    from ..config import settings as cfg
    if not cfg.groq_api_key:
        raise EnvironmentError("GROQ_API_KEY is not configured.")
    client = Groq(api_key=cfg.groq_api_key)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content.strip()


@router.post("/{job_id}/interview-prep")
async def get_interview_prep(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import asyncio, json as _json, re as _re
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    skills = ", ".join(profile.technical_skills[:15]) if profile and profile.technical_skills else "N/A"

    prompt = f"""You are an expert interview coach. Generate 10 interview questions WITH complete model answers for this candidate.

ROLE: {job.job_title or "N/A"} at {job.company_name or "N/A"}
LOCATION: {job.location or "N/A"}
JOB DESCRIPTION:
{(job.job_description or "")[:2000]}

CANDIDATE:
Name: {profile.full_name if profile else "The Candidate"}
Current Title: {profile.current_job_title if profile else "N/A"}
Experience: {profile.years_of_experience if profile else "N/A"}
Skills: {skills}
Summary: {profile.professional_summary if profile else "N/A"}

Generate exactly 10 questions covering:
- 1 opener: "Tell me about yourself" tailored to this specific role
- 3 technical questions specific to the job requirements
- 2 behavioral questions using STAR method
- 2 company/role-fit questions
- 2 problem-solving / situational questions

For EACH question provide:
- "question": the interview question
- "category": one of "opener", "technical", "behavioral", "company", "problem-solving"
- "tip": one sentence on what the interviewer is really looking for
- "sample_answer": a complete, specific, ready-to-use model answer (3-5 sentences) tailored to this candidate's background and this specific role. The answer should be concrete, use the candidate's skills where relevant, and be something the candidate can directly adapt and use.

IMPORTANT: Return ONLY a valid JSON array. Use double quotes. Do not use apostrophes — write "do not" instead of "don't", "I am" instead of "I'm". No trailing commas. No markdown code blocks.
[{{"question": "...", "category": "opener", "tip": "...", "sample_answer": "..."}}]"""

    try:
        loop = asyncio.get_running_loop()
        raw = await loop.run_in_executor(None, lambda: _groq_call(prompt, temperature=0.3, max_tokens=3000))

        start = raw.find("[")
        end = raw.rfind("]") + 1
        json_str = raw[start:end] if start >= 0 else "[]"
        json_str = _re.sub(r"```[a-z]*", "", json_str).strip()

        try:
            questions = _json.loads(json_str)
        except _json.JSONDecodeError:
            cleaned = json_str.replace("\\'", " ").replace("'", " ")
            cleaned = _re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', cleaned)
            try:
                questions = _json.loads(cleaned)
            except Exception:
                questions = []

        for q in questions:
            q.setdefault("tip", "Focus on being specific and concise.")
            q.setdefault("sample_answer", "Prepare a specific example from your experience that directly relates to this question.")

        return {"questions": questions, "job_title": job.job_title, "company_name": job.company_name}
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Interview prep generation failed")
        raise HTTPException(status_code=502, detail=f"Could not generate interview prep: {str(e)}")


@router.post("/{job_id}/company-brief")
async def get_company_brief(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import asyncio
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if not job.company_name:
        raise HTTPException(status_code=400, detail="No company name for this job.")

    prompt = f"""Provide a concise factual brief about {job.company_name}.

Job context (use this to infer company details):
{(job.job_description or "")[:1500]}

Write 4 bullet points covering:
• What the company does (core product/service, industry)
• Company size and stage (startup/scaleup/enterprise, approximate headcount if known)
• Market position and notable achievements
• Engineering/tech culture highlights relevant to a job seeker

Be specific and factual. Each bullet should start with "•". Keep each bullet to 1–2 sentences.
Do not speculate — if something is unknown, skip it."""

    try:
        loop = asyncio.get_running_loop()
        text = await loop.run_in_executor(None, lambda: _groq_call(prompt, temperature=0.4, max_tokens=512))
        return {"brief": text, "company_name": job.company_name}
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not generate company brief: {str(e)}")


@router.post("/{job_id}/salary-estimate")
async def estimate_salary(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import asyncio, json as _json
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    experience = profile.years_of_experience if profile else "N/A"

    prompt = f"""Estimate a realistic salary range for this position.

ROLE: {job.job_title or "N/A"} at {job.company_name or "N/A"}
LOCATION: {job.location or "N/A"}
CANDIDATE EXPERIENCE: {experience}
JOB DESCRIPTION:
{(job.job_description or "")[:1200]}

Provide a realistic salary estimate based on:
- The specific location (cost of living, local market rates)
- Role level inferred from description (junior/mid/senior/lead)
- Industry and company type
- Current market rates for this skill set

Use the local currency (INR for India, USD for USA/Canada, GBP for UK, EUR for European countries, SGD for Singapore, AED for UAE, etc.).

Return ONLY this JSON, no other text:
{{"min": <integer>, "max": <integer>, "currency": "<3-letter-code>", "period": "annual", "confidence": "high|medium|low", "note": "<1 sentence explaining the estimate>"}}"""

    try:
        loop = asyncio.get_running_loop()
        raw = await loop.run_in_executor(None, lambda: _groq_call(prompt, temperature=0.2, max_tokens=256))
        start = raw.find("{")
        end = raw.rfind("}") + 1
        json_str = raw[start:end] if start >= 0 else "{}"
        try:
            data = _json.loads(json_str)
        except _json.JSONDecodeError:
            data = {}

        if data.get("min") and data.get("max"):
            job.salary_min = int(data["min"])
            job.salary_max = int(data["max"])
            job.salary_currency = data.get("currency", "USD")
            job.salary_note = data.get("note", "")
            try:
                db.commit()
            except Exception:
                db.rollback()

        return {**data, "job_title": job.job_title, "company_name": job.company_name}
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not estimate salary: {str(e)}")
