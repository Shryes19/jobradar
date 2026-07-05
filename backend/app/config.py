import secrets
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str = ""
    apify_api_key: str = ""
    database_url: str = "sqlite:///./jobradar.db"
    secret_key: str = secrets.token_hex(32)  # override in production via SECRET_KEY env var

    class Config:
        env_file = ".env"


settings = Settings()
