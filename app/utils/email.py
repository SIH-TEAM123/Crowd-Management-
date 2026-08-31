import requests

from app.config import settings


def send_otp_email(
    recipient_email: str,
    otp: str
):
    url = "https://api.brevo.com/v3/smtp/email"

    headers = {
        "accept": "application/json",
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json"
    }

    payload = {
        "sender": {
            "name": settings.BREVO_FROM_NAME,
            "email": settings.BREVO_FROM_EMAIL
        },
        "to": [
            {
                "email": recipient_email
            }
        ],
        "subject": "Queue Management - Email Verification OTP",
        "textContent": f"""
Hello,

Your OTP for email verification is:

{otp}

This OTP is valid for 5 minutes.

If you did not create this account, please ignore this email.

Regards,
Queue Management Team
"""
    }

    response = requests.post(
        url,
        headers=headers,
        json=payload,
        timeout=30
    )

    response.raise_for_status()

    return response.json()