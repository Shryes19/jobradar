from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Profile, User
from ..schemas import ProfileResponse
from ..cv_parser import extract_text_from_pdf, parse_cv_with_groq
from ..auth import get_current_user

router = APIRouter(prefix="/api/profile", tags=["profile"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload", response_model=ProfileResponse)
async def upload_cv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File is too large. Maximum size is 10 MB.")

    try:
        cv_text = extract_text_from_pdf(contents)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to read the PDF. Please try a different file.")

    try:
        parsed = parse_cv_with_groq(cv_text)
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {str(e)}")

    existing = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if existing:
        existing.full_name           = parsed["full_name"]
        existing.current_job_title   = parsed["current_job_title"]
        existing.years_of_experience = parsed["years_of_experience"]
        existing.technical_skills    = parsed["technical_skills"]
        existing.professional_summary = parsed["professional_summary"]
        existing.raw_cv_text         = cv_text
        db.commit()
        db.refresh(existing)
        profile = existing
    else:
        profile = Profile(
            user_id=current_user.id,
            full_name=parsed["full_name"],
            current_job_title=parsed["current_job_title"],
            years_of_experience=parsed["years_of_experience"],
            professional_summary=parsed["professional_summary"],
            raw_cv_text=cv_text,
        )
        profile.technical_skills = parsed["technical_skills"]
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return ProfileResponse(
        id=profile.id,
        full_name=profile.full_name,
        current_job_title=profile.current_job_title,
        years_of_experience=profile.years_of_experience,
        technical_skills=profile.technical_skills,
        professional_summary=profile.professional_summary,
        created_at=profile.created_at,
    )


@router.get("/me", response_model=ProfileResponse)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile found. Please upload your CV first.")
    return ProfileResponse(
        id=profile.id,
        full_name=profile.full_name,
        current_job_title=profile.current_job_title,
        years_of_experience=profile.years_of_experience,
        technical_skills=profile.technical_skills,
        professional_summary=profile.professional_summary,
        created_at=profile.created_at,
    )
