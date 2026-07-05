import json
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, func, UniqueConstraint
from .database import Base


class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    email      = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name  = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Profile(Base):
    __tablename__ = "profiles"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    full_name            = Column(String(255), nullable=True)
    current_job_title    = Column(String(255), nullable=True)
    years_of_experience  = Column(String(50), nullable=True)
    technical_skills_json = Column(Text, nullable=True)
    professional_summary = Column(Text, nullable=True)
    raw_cv_text          = Column(Text, nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def technical_skills(self):
        if self.technical_skills_json:
            return json.loads(self.technical_skills_json)
        return []

    @technical_skills.setter
    def technical_skills(self, value):
        self.technical_skills_json = json.dumps(value) if value else "[]"


DEFAULT_KANBAN_COLUMNS = [
    {"id": "saved",               "label": "Saved"},
    {"id": "applied",             "label": "Applied"},
    {"id": "screening",           "label": "Screening"},
    {"id": "technical_interview", "label": "Technical Interview"},
    {"id": "offer",               "label": "Offer"},
    {"id": "rejected",            "label": "Rejected"},
]


class UserSettings(Base):
    __tablename__ = "user_settings"

    id                   = Column(Integer, primary_key=True)
    user_id              = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    default_job_title    = Column(String(255), default="")
    default_location     = Column(String(255), default="")
    result_count         = Column(Integer, default=25)
    search_presets_json  = Column(Text, default="[]")
    min_match_score      = Column(Integer, default=0)
    auto_score           = Column(Boolean, default=True)
    skills_blacklist_json = Column(Text, default="[]")
    stale_days           = Column(Integer, default=7)
    kanban_columns_json  = Column(Text, default="null")
    dashboard_days       = Column(Integer, default=0)

    @property
    def search_presets(self):
        return json.loads(self.search_presets_json or "[]")

    @search_presets.setter
    def search_presets(self, v):
        self.search_presets_json = json.dumps(v)

    @property
    def skills_blacklist(self):
        return json.loads(self.skills_blacklist_json or "[]")

    @skills_blacklist.setter
    def skills_blacklist(self, v):
        self.skills_blacklist_json = json.dumps(v)

    @property
    def kanban_columns(self):
        raw = json.loads(self.kanban_columns_json or "null")
        return raw if raw else DEFAULT_KANBAN_COLUMNS

    @kanban_columns.setter
    def kanban_columns(self, v):
        self.kanban_columns_json = json.dumps(v)


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("user_id", "linkedin_url", name="uq_jobs_user_linkedin_url"),)

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    job_title        = Column(String(255), nullable=True)
    company_name     = Column(String(255), nullable=True)
    location         = Column(String(255), nullable=True)
    job_description  = Column(Text, nullable=True)
    linkedin_url     = Column(String(2048), nullable=True, index=True)
    match_score      = Column(Integer, nullable=True)
    scored_profile_id = Column(Integer, nullable=True)
    status           = Column(String(50), nullable=True)
    status_updated_at = Column(DateTime(timezone=True), nullable=True)
    notes            = Column(Text, nullable=True)
    follow_up_date   = Column(DateTime(timezone=True), nullable=True)
    platform         = Column(String(50), nullable=True, default="linkedin")
    salary_min       = Column(Integer, nullable=True)
    salary_max       = Column(Integer, nullable=True)
    salary_currency  = Column(String(10), nullable=True)
    salary_note      = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


class ScheduledSearch(Base):
    __tablename__ = "scheduled_searches"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name            = Column(String(255), nullable=False)
    job_title       = Column(String(255), nullable=False)
    location        = Column(String(255), nullable=False)
    platform        = Column(String(50), default="linkedin")
    frequency_hours = Column(Integer, default=24)
    result_count    = Column(Integer, default=15)
    enabled         = Column(Boolean, default=True)
    last_run        = Column(DateTime(timezone=True), nullable=True)
    new_jobs_found  = Column(Integer, default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
