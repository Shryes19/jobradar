import json
import pdfplumber
from groq import Groq
from .config import settings


def extract_text_from_pdf(file_bytes: bytes) -> str:
    import io
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    text = "\n".join(pages).strip()
    if not text:
        raise ValueError("Could not extract text from the PDF. The file may be scanned or image-based.")
    return text


def parse_cv_with_groq(cv_text: str) -> dict:
    if not settings.groq_api_key:
        raise EnvironmentError(
            "GROQ_API_KEY is not set. Please add it to your .env file in the backend directory."
        )

    client = Groq(api_key=settings.groq_api_key)

    prompt = f"""You are a CV/resume parser. Extract the following fields from the CV text below and return a valid JSON object.
If a field cannot be determined, use null for strings or an empty array for lists.

Fields to extract:
- full_name: The person's full name
- current_job_title: Their current or most recent job title
- years_of_experience: Total years of professional experience as a string (e.g. "5 years", "3-5 years")
- technical_skills: Array of technical skills, tools, languages, and frameworks mentioned
- professional_summary: A 2-3 sentence summary of the person's professional background

Return ONLY valid JSON, no markdown, no explanation.

CV Text:
{cv_text[:8000]}"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=1024,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError("The AI returned an unexpected response format. Please try again.")

    return {
        "full_name": parsed.get("full_name"),
        "current_job_title": parsed.get("current_job_title"),
        "years_of_experience": parsed.get("years_of_experience"),
        "technical_skills": parsed.get("technical_skills") or [],
        "professional_summary": parsed.get("professional_summary"),
    }
