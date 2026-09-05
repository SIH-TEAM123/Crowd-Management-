import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL")
    JWT_SECRET = os.getenv("JWT_SECRET")

    SMTP_HOST = os.getenv("SMTP_HOST")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
    SMTP_FROM = os.getenv("SMTP_FROM")

    # Unified Queue & Token Settings (first token is 114, approx 3 minutes service rate)
    TOKEN_START: int = int(os.getenv("TOKEN_START", "114"))
    DEFAULT_SERVICE_RATE_MINUTES: float = float(os.getenv("DEFAULT_SERVICE_RATE_MINUTES", "3.0"))


settings = Settings()