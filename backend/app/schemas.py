from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


class ProfileBase(BaseModel):
    full_name: Optional[str] = None
    current_job_title: Optional[str] = None
    years_of_experience: Optional[str] = None
    technical_skills: List[str] = []
    professional_summary: Optional[str] = None


class ProfileCreate(ProfileBase):
    raw_cv_text: Optional[str] = None


class ProfileResponse(ProfileBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


VALID_STATUSES = {"saved", "applied", "screening", "technical_interview", "offer", "rejected"}

class JobResponse(BaseModel):
    id: int
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    location: Optional[str] = None
    job_description: Optional[str] = None
    linkedin_url: Optional[str] = None
    platform: Optional[str] = "linkedin"
    match_score: Optional[int] = None
    status: Optional[str] = None
    status_updated_at: Optional[datetime] = None
    notes: Optional[str] = None
    follow_up_date: Optional[datetime] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    salary_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotesUpdate(BaseModel):
    notes: str


class FollowUpUpdate(BaseModel):
    follow_up_date: Optional[datetime] = None


class StatusUpdate(BaseModel):
    status: str


class ScoreRequest(BaseModel):
    job_ids: List[int]
    skills_blacklist: List[str] = []


class SearchPreset(BaseModel):
    name: str
    job_title: str
    location: str


class KanbanColumn(BaseModel):
    id: str
    label: str


class UserSettingsSchema(BaseModel):
    default_job_title: str = ""
    default_location: str = ""
    result_count: int = 25
    search_presets: List[SearchPreset] = []
    min_match_score: int = 0
    auto_score: bool = True
    skills_blacklist: List[str] = []
    stale_days: int = 7
    kanban_columns: Optional[List[KanbanColumn]] = None
    dashboard_days: int = 0

    class Config:
        from_attributes = True


class JobScoreResult(BaseModel):
    job_id: int
    score: Optional[int] = None
    error: Optional[str] = None


class FetchJobsRequest(BaseModel):
    job_title: str
    location: str
    count: int = 15
    platform: str = "linkedin"  # "linkedin" | "indeed"


class SalaryUpdate(BaseModel):
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    salary_note: Optional[str] = None


class ScheduledSearchCreate(BaseModel):
    name: str
    job_title: str
    location: str
    platform: str = "linkedin"
    frequency_hours: int = 24
    result_count: int = 15
    enabled: bool = True


class ScheduledSearchResponse(BaseModel):
    id: int
    name: str
    job_title: str
    location: str
    platform: str
    frequency_hours: int
    result_count: int
    enabled: bool
    last_run: Optional[datetime] = None
    new_jobs_found: int
    created_at: datetime

    class Config:
        from_attributes = True


class FunnelStage(BaseModel):
    stage: str
    label: str
    count: int


class AnalyticsResponse(BaseModel):
    total_applications: int
    response_rate: Optional[float] = None   # None when no applications
    average_match_score: Optional[float] = None  # None when no scored applications
    funnel: List[FunnelStage]
