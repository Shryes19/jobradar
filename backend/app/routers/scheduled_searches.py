from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ScheduledSearch, Job, User
from ..schemas import ScheduledSearchCreate, ScheduledSearchResponse
from ..auth import get_current_user

router = APIRouter(prefix="/api/scheduled-searches", tags=["scheduled-searches"])


@router.get("/", response_model=list[ScheduledSearchResponse])
def list_searches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(ScheduledSearch).filter(ScheduledSearch.user_id == current_user.id).order_by(ScheduledSearch.created_at.desc()).all()


@router.post("/", response_model=ScheduledSearchResponse)
def create_search(
    body: ScheduledSearchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.name.strip() or not body.job_title.strip() or not body.location.strip():
        raise HTTPException(status_code=400, detail="Name, job title, and location are required.")
    s = ScheduledSearch(**body.model_dump(), user_id=current_user.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.patch("/{search_id}", response_model=ScheduledSearchResponse)
def toggle_search(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(ScheduledSearch).filter(ScheduledSearch.id == search_id, ScheduledSearch.user_id == current_user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scheduled search not found.")
    s.enabled = not s.enabled
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{search_id}", status_code=204)
def delete_search(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(ScheduledSearch).filter(ScheduledSearch.id == search_id, ScheduledSearch.user_id == current_user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scheduled search not found.")
    db.delete(s)
    db.commit()


@router.post("/run")
async def run_due_searches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..apify_service import fetch_linkedin_jobs, normalize_job, fetch_indeed_jobs, normalize_indeed_job

    now = datetime.now(timezone.utc)
    searches = db.query(ScheduledSearch).filter(ScheduledSearch.user_id == current_user.id, ScheduledSearch.enabled == True).all()

    results = []
    ran_count = 0

    for search in searches:
        if search.last_run is not None:
            next_run = search.last_run + timedelta(hours=search.frequency_hours)
            if next_run > now:
                continue

        ran_count += 1
        try:
            if search.platform == "indeed":
                raw_jobs = await fetch_indeed_jobs(search.job_title, search.location, search.result_count)
                normalizer = normalize_indeed_job
            else:
                raw_jobs = await fetch_linkedin_jobs(search.job_title, search.location, search.result_count)
                normalizer = normalize_job

            new_count = 0
            for raw in raw_jobs:
                normalized = normalizer(raw)
                if not normalized.get("job_title") and not normalized.get("company_name"):
                    continue
                job_url = normalized.get("linkedin_url", "")
                existing = db.query(Job).filter(Job.user_id == current_user.id, Job.linkedin_url == job_url).first() if job_url else None
                if not existing:
                    job = Job(**normalized, platform=search.platform, user_id=current_user.id)
                    db.add(job)
                    try:
                        db.commit()
                        new_count += 1
                    except Exception:
                        db.rollback()

            search.last_run = now
            search.new_jobs_found = new_count
            db.commit()
            results.append({"search_id": search.id, "name": search.name, "new_jobs": new_count, "status": "ok"})
        except Exception as e:
            results.append({"search_id": search.id, "name": search.name, "error": str(e), "status": "error"})

    total_new = sum(r.get("new_jobs", 0) for r in results)
    return {"checked": len(searches), "ran": ran_count, "total_new_jobs": total_new, "results": results}
