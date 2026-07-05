import re
import urllib.parse
import httpx
from .config import settings

APIFY_ACTOR = "curious_coder~linkedin-jobs-scraper"
INDEED_ACTOR = "misceres~indeed-scraper"
APIFY_BASE = "https://api.apify.com/v2"
TIMEOUT = 180


def build_linkedin_search_url(job_title: str, location: str) -> str:
    keywords = urllib.parse.quote_plus(job_title.strip())
    loc = urllib.parse.quote_plus(location.strip())
    return (
        f"https://www.linkedin.com/jobs/search/"
        f"?keywords={keywords}&location={loc}&position=1&pageNum=0"
    )


def _strip_html(html: str) -> str:
    """Minimal HTML tag stripper — keeps text, newlines for readability."""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def fetch_linkedin_jobs(job_title: str, location: str, count: int = 15) -> list[dict]:
    if not settings.apify_api_key:
        raise EnvironmentError(
            "APIFY_API_KEY is not set. Add it to your backend/.env file and restart the server."
        )

    search_url = build_linkedin_search_url(job_title, location)

    # Actor requires urls as plain strings, minimum count is 10
    run_input = {
        "urls": [search_url],
        "count": max(count, 10),
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            f"{APIFY_BASE}/acts/{APIFY_ACTOR}/run-sync-get-dataset-items",
            params={"token": settings.apify_api_key, "timeout": 150},
            json=run_input,
        )

    if resp.status_code == 401:
        raise PermissionError("Invalid Apify API key. Check your APIFY_API_KEY in backend/.env.")
    if resp.status_code == 404:
        raise LookupError("Apify actor not found. Please contact support.")
    if resp.status_code >= 400:
        raise RuntimeError(f"Apify returned an error (HTTP {resp.status_code}): {resp.text[:300]}")

    data = resp.json()
    if not isinstance(data, list):
        raise ValueError("Unexpected response format from Apify. Please try again.")

    return data


async def fetch_indeed_jobs(job_title: str, location: str, count: int = 15) -> list[dict]:
    if not settings.apify_api_key:
        raise EnvironmentError(
            "APIFY_API_KEY is not set. Add it to your backend/.env file and restart the server."
        )
    run_input = {
        "keyword": job_title.strip(),
        "location": location.strip(),
        "maxItems": max(count, 10),
        "scrapeCompanyReviews": False,
        "startUrls": [],
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            f"{APIFY_BASE}/acts/{INDEED_ACTOR}/run-sync-get-dataset-items",
            params={"token": settings.apify_api_key, "timeout": 150},
            json=run_input,
        )
    if resp.status_code == 401:
        raise PermissionError("Invalid Apify API key.")
    if resp.status_code == 404:
        raise LookupError("Indeed scraper actor not found.")
    if resp.status_code >= 400:
        raise RuntimeError(f"Indeed scraper returned HTTP {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    if not isinstance(data, list):
        raise ValueError("Unexpected response format from Indeed scraper.")
    return data


def normalize_indeed_job(raw: dict) -> dict:
    description = raw.get("description") or raw.get("jobDescription") or raw.get("snippet") or ""
    if "<" in description:
        description = _strip_html(description)
    return {
        "job_title": raw.get("positionName") or raw.get("title") or raw.get("jobTitle") or "",
        "company_name": raw.get("company") or raw.get("companyName") or "",
        "location": raw.get("location") or raw.get("jobLocation") or "",
        "job_description": description,
        "linkedin_url": raw.get("url") or raw.get("externalApplyLink") or raw.get("jobUrl") or "",
    }


def normalize_job(raw: dict) -> dict:
    """Map curious_coder/linkedin-jobs-scraper output fields to our Job schema."""
    description_html = raw.get("descriptionHtml") or ""
    description = _strip_html(description_html) if description_html else (raw.get("description") or "")

    return {
        "job_title": raw.get("title") or raw.get("jobTitle") or "",
        "company_name": raw.get("companyName") or raw.get("company") or "",
        "location": raw.get("location") or "",
        "job_description": description,
        "linkedin_url": raw.get("link") or raw.get("jobUrl") or raw.get("url") or "",
    }
