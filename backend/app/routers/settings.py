import re
from pathlib import Path
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from ..config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class SettingsStatus(BaseModel):
    groq_configured: bool
    apify_configured: bool


class SettingsUpdate(BaseModel):
    groq_api_key: Optional[str] = None
    apify_api_key: Optional[str] = None


def _write_env_key(key: str, value: str) -> None:
    content = ENV_PATH.read_text() if ENV_PATH.exists() else ""
    pattern = re.compile(rf"^{key}=.*$", re.MULTILINE)
    new_line = f"{key}={value}"
    if pattern.search(content):
        content = pattern.sub(new_line, content)
    else:
        content = content.rstrip("\n") + ("\n" if content else "") + new_line + "\n"
    ENV_PATH.write_text(content)


@router.get("/", response_model=SettingsStatus)
def get_settings_status():
    return SettingsStatus(
        groq_configured=bool(settings.groq_api_key),
        apify_configured=bool(settings.apify_api_key),
    )


@router.post("/")
def save_settings(body: SettingsUpdate):
    if body.groq_api_key is not None:
        value = body.groq_api_key.strip()
        _write_env_key("GROQ_API_KEY", value)
        settings.groq_api_key = value

    if body.apify_api_key is not None:
        value = body.apify_api_key.strip()
        _write_env_key("APIFY_API_KEY", value)
        settings.apify_api_key = value

    return {"message": "Settings saved successfully."}
