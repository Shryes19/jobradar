from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .database import Base, engine
from .routers import profile, jobs, settings, user_settings, analytics_extra, scheduled_searches
from .routers import auth as auth_router

Base.metadata.create_all(bind=engine)


def _run_migrations():
    with engine.connect() as conn:
        # jobs columns
        for col, typedef in [
            ("match_score", "INTEGER"),
            ("scored_profile_id", "INTEGER"),
            ("status", "VARCHAR(50)"),
            ("status_updated_at", "DATETIME"),
            ("notes", "TEXT"),
            ("follow_up_date", "DATETIME"),
            ("platform", "VARCHAR(50)"),
            ("salary_min", "INTEGER"),
            ("salary_max", "INTEGER"),
            ("salary_currency", "VARCHAR(10)"),
            ("salary_note", "TEXT"),
            ("user_id", "INTEGER"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col} {typedef}"))
                conn.commit()
            except Exception:
                pass

        # profiles user_id
        try:
            conn.execute(text("ALTER TABLE profiles ADD COLUMN user_id INTEGER"))
            conn.commit()
        except Exception:
            pass

        # user_settings user_id
        try:
            conn.execute(text("ALTER TABLE user_settings ADD COLUMN user_id INTEGER"))
            conn.commit()
        except Exception:
            pass

        # scheduled_searches user_id
        try:
            conn.execute(text("ALTER TABLE scheduled_searches ADD COLUMN user_id INTEGER"))
            conn.commit()
        except Exception:
            pass


_run_migrations()

app = FastAPI(title="JobRadar API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://jobradar.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(profile.router)
app.include_router(jobs.router)
app.include_router(settings.router)
app.include_router(user_settings.router)
app.include_router(analytics_extra.router)
app.include_router(scheduled_searches.router)


@app.get("/health")
def health():
    return {"status": "ok"}
