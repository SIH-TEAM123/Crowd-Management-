import smtplib
from email.message import EmailMessage

from app.config import settings


def send_otp_email(
    recipient_email: str,
    otp: str
):

    message = EmailMessage()

    message["Subject"] = "Queue Management - Email Verification OTP"
    message["From"] = settings.SMTP_FROM
    message["To"] = recipient_email

    message.set_content(
        f"""
Hello,

Your OTP for email verification is:

{otp}

This OTP is valid for 5 minutes.

If you did not create this account, please ignore this email.

Regards,
Queue Management Team
"""
    )

    if not settings.SMTP_HOST or not settings.SMTP_USERNAME or settings.SMTP_HOST == "smtp.example.com":
        print(f"[DEV MODE] SMTP not configured. OTP for {recipient_email}: {otp}")
        return

    try:
        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=10
        ) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(
                settings.SMTP_USERNAME,
                settings.SMTP_PASSWORD
            )
            server.send_message(message)
    except Exception as exc:
        print(f"[DEV FALLBACK] Failed to send email via SMTP ({exc}). OTP for {recipient_email}: {otp}")