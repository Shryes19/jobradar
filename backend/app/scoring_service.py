import asyncio
import json
import time
from groq import Groq, RateLimitError
from .config import settings

MAX_CONCURRENT = 5
MAX_RETRIES = 3
RETRY_DELAY = 4

_semaphore: asyncio.Semaphore | None = None

def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    return _semaphore


def _build_profile_text(profile) -> str:
    skills = ", ".join(profile.technical_skills) if profile.technical_skills else "N/A"
    return (
        f"Name: {profile.full_name or 'N/A'}\n"
        f"Title: {profile.current_job_title or 'N/A'}\n"
        f"Experience: {profile.years_of_experience or 'N/A'}\n"
        f"Skills: {skills}\n"
        f"Summary: {profile.professional_summary or 'N/A'}"
    )


def _score_single(profile_text: str, job_description: str) -> int:
    client = Groq(api_key=settings.groq_api_key)

    for attempt in range(MAX_RETRIES):
        try:
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a recruitment assistant. Given the candidate profile "
                            "and the job description, return a match score as a JSON object "
                            "with a single key called score. The score is an integer 0 to 100 "
                            "representing how well the candidate fits the role. "
                            "Return ONLY the JSON object, no explanation."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Profile:\n{profile_text}\n\nJob Description:\n{job_description}",
                    },
                ],
                temperature=0.1,
                max_tokens=64,
            )

            raw = completion.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

            parsed = json.loads(raw)
            score = int(parsed["score"])
            return max(0, min(100, score))

        except RateLimitError:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                raise
        except (json.JSONDecodeError, KeyError, ValueError):
            raise ValueError("Invalid score response from AI.")

    raise RuntimeError("Max retries exceeded.")


async def score_job(profile_text: str, job_description: str) -> int:
    sem = _get_semaphore()
    async with sem:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _score_single, profile_text, job_description)


async def score_jobs_parallel(profile, jobs: list, skills_blacklist: list[str] | None = None) -> dict[int, int]:
    if not settings.groq_api_key:
        raise EnvironmentError("GROQ_API_KEY is not set in backend/.env.")

    profile_text = _build_profile_text(profile)
    if skills_blacklist:
        profile_text += f"\nNote: exclude these skills from match scoring: {', '.join(skills_blacklist)}"

    async def score_one(job) -> tuple[int, int]:
        desc = (job.job_description or "").strip()
        if not desc:
            return job.id, 0
        try:
            score = await score_job(profile_text, desc[:4000])
            return job.id, score
        except Exception:
            return job.id, -1

    results = await asyncio.gather(*[score_one(j) for j in jobs])
    return dict(results)
