import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL")
    JWT_SECRET = os.getenv("JWT_SECRET")

    BREVO_API_KEY = os.getenv("BREVO_API_KEY")
    BREVO_FROM_EMAIL = os.getenv("BREVO_FROM_EMAIL")
    BREVO_FROM_NAME = os.getenv(
        "BREVO_FROM_NAME",
        "Queue Management Team"
    )


settings = Settings()