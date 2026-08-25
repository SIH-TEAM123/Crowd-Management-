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

    with smtplib.SMTP_SSL(
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        timeout=30
    ) as server:

        server.login(
            settings.SMTP_USERNAME,
            settings.SMTP_PASSWORD
        )

        server.send_message(message)