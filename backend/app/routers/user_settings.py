from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import UserSettings, User
from ..schemas import UserSettingsSchema, SearchPreset, KanbanColumn
from ..auth import get_current_user

router = APIRouter(prefix="/api/user-settings", tags=["user-settings"])


def _get_or_create(db: Session, user_id: int) -> UserSettings:
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not row:
        row = UserSettings(user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _to_schema(row: UserSettings) -> dict:
    cols = row.kanban_columns
    return {
        "default_job_title": row.default_job_title or "",
        "default_location":  row.default_location or "",
        "result_count":      row.result_count if row.result_count is not None else 25,
        "search_presets":    row.search_presets,
        "min_match_score":   row.min_match_score if row.min_match_score is not None else 0,
        "auto_score":        row.auto_score if row.auto_score is not None else True,
        "skills_blacklist":  row.skills_blacklist,
        "stale_days":        row.stale_days if row.stale_days is not None else 7,
        "kanban_columns":    cols,
        "dashboard_days":    row.dashboard_days if row.dashboard_days is not None else 0,
    }


@router.get("/", response_model=UserSettingsSchema)
def get_user_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _to_schema(_get_or_create(db, current_user.id))


@router.put("/", response_model=UserSettingsSchema)
def update_user_settings(
    body: UserSettingsSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = _get_or_create(db, current_user.id)

    row.default_job_title = body.default_job_title
    row.default_location  = body.default_location
    row.result_count      = max(10, min(50, body.result_count))
    row.search_presets    = [p.model_dump() for p in body.search_presets]
    row.min_match_score   = max(0, min(100, body.min_match_score))
    row.auto_score        = body.auto_score
    row.skills_blacklist  = body.skills_blacklist
    row.stale_days        = max(0, body.stale_days)
    row.kanban_columns    = (
        [c.model_dump() for c in body.kanban_columns]
        if body.kanban_columns is not None
        else None
    )
    row.dashboard_days    = body.dashboard_days

    db.commit()
    db.refresh(row)
    return _to_schema(row)
