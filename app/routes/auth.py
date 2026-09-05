from datetime import datetime, timedelta
import asyncio
from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.utils.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.otp import OTPVerification
from app.schemas.auth import RegisterRequest, LoginRequest

from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)

from typing import Optional
from pydantic import BaseModel
from app.config import settings
from app.models.patient import Patient
from app.utils.otp import generate_otp
from app.utils.email import send_otp_email
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    VerifyOTPRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResendOTPRequest
)


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)



# =========================
# REGISTER / SIGNUP
# =========================

@router.post("/register")
@router.post("/signup")
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):

    # 1. Check if email already exists
    result = await db.execute(
        select(User).where(User.email == data.email)
    )

    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # 2. Get latest user ID
    result = await db.execute(
        select(func.max(User.user_id))
    )

    last_id = result.scalar_one_or_none()

    # 3. Generate next user ID
    if last_id is None:
        new_id = "001"
    else:
        new_id = f"{int(last_id) + 1:03d}"

    # 4. Hash password
    hashed_password = hash_password(
        data.password
    )

    # 5. Create user
    user = User(
    user_id=new_id,
    full_name=data.full_name,
    email=data.email,
    password_hash=hashed_password,
    is_verified=False,
    role="user"
)

    db.add(user)

    # Make user available before creating OTP
    await db.flush()

    # 6. Generate OTP
    otp = generate_otp()

    print("================================")
    print("OTP FOR TESTING:", otp)
    print("================================")

# 7. Hash OTP
    otp_hash = hash_password(otp)

    # 8. OTP expires after 5 minutes
    expires_at = (
        datetime.utcnow()
        + timedelta(minutes=5)
    )

    # 9. Create OTP record
    otp_record = OTPVerification(
        user_id=user.user_id,
        otp_hash=otp_hash,
        expires_at=expires_at,
        purpose="signup"
    )

    db.add(otp_record)
    await db.commit()

    await asyncio.to_thread(
        send_otp_email,
        data.email,
        otp
    )

    resp = {
        "message": "Account created. OTP sent to your email.",
        "user_id": user.user_id
    }
    if not settings.SMTP_HOST or settings.SMTP_HOST == "smtp.example.com" or not settings.SMTP_USERNAME:
        resp["dev_otp"] = otp
    return resp

# =========================
# VERIFY SIGNUP OTP
# =========================

@router.post("/verify-otp")
async def verify_otp(
    data: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db)
):

    # 1. Find user
    result = await db.execute(
        select(User).where(User.email == data.email)
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # 2. Check if already verified
    if user.is_verified:
        raise HTTPException(
            status_code=400,
            detail="Email already verified"
        )

    # 3. Find latest signup OTP
    result = await db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.user_id == user.user_id,
            OTPVerification.purpose == "signup"
        )
        .order_by(
            OTPVerification.created_at.desc()
        )
    )

    otp_record = result.scalars().first()

    if otp_record is None:
        raise HTTPException(
            status_code=400,
            detail="OTP not found"
        )

    # 4. Check OTP expiry
    if datetime.utcnow() > otp_record.expires_at:
        raise HTTPException(
            status_code=400,
            detail="OTP has expired"
        )

    # 5. Check OTP
    if not verify_password(
        data.otp,
        otp_record.otp_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP"
        )

    # 6. Verify user
    user.is_verified = True

    # 7. Delete used OTP
    await db.delete(otp_record)

    # 8. Save changes
    await db.commit()

    return {
        "message": "Email verified successfully"
    }


# =========================
# RESEND SIGNUP OTP
# =========================

@router.post("/resend-otp")
async def resend_otp(
    data: ResendOTPRequest,
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(
        select(User).where(User.email == data.email)
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if user.is_verified:
        raise HTTPException(
            status_code=400,
            detail="Email already verified"
        )

    result = await db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.user_id == user.user_id,
            OTPVerification.purpose == "signup"
        )
    )

    old_otps = result.scalars().all()

    for old_otp in old_otps:
        await db.delete(old_otp)

    otp = generate_otp()

    print("================================")
    print("RESEND SIGNUP OTP:", otp)
    print("================================")

    otp_hash = hash_password(otp)

    expires_at = (
        datetime.utcnow()
        + timedelta(minutes=5)
    )

    otp_record = OTPVerification(
        user_id=user.user_id,
        otp_hash=otp_hash,
        expires_at=expires_at,
        purpose="signup"
    )

    db.add(otp_record)

    await db.commit()

    await asyncio.to_thread(
        send_otp_email,
        data.email,
        otp
    )

    resp = {
        "message": "A new OTP has been sent to your email."
    }
    if not settings.SMTP_HOST or settings.SMTP_HOST == "smtp.example.com" or not settings.SMTP_USERNAME:
        resp["dev_otp"] = otp
    return resp



# =========================
# LOGIN
# =========================

@router.post("/login")
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):

    # 1. Find user (flexible: case-insensitive email, full_name, or user_id)
    raw_ident = (data.email or "").strip()
    ident_lower = raw_ident.lower()

    result = await db.execute(
        select(User).where(func.lower(func.trim(User.email)) == ident_lower)
    )
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(
            select(User).where(
                or_(
                    func.lower(func.trim(User.full_name)) == ident_lower,
                    User.user_id == raw_ident
                )
            ).order_by(User.user_id.desc())
        )
        user = result.scalars().first()

    # 2. User doesn't exist
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # 3. Check password
    password_correct = verify_password(
        data.password,
        user.password_hash
    )

    if not password_correct:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # 4. Check email verification
    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email first"
        )

    # 5. Create JWT
    access_token = create_access_token(
        user.user_id
    )

    # 6. Return token
    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer"
    }

# =========================
# FORGOT PASSWORD
# =========================

@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(
        select(User).where(User.email == data.email)
    )

    user = result.scalar_one_or_none()

    if user is None:
        return {
            "message": "If the email exists, a password reset OTP has been sent."
        }

    otp = generate_otp()

    print("================================")
    print("PASSWORD RESET OTP:", otp)
    print("================================")

    otp_hash = hash_password(otp)

    expires_at = (
        datetime.utcnow()
        + timedelta(minutes=5)
    )

    otp_record = OTPVerification(
        user_id=user.user_id,
        otp_hash=otp_hash,
        expires_at=expires_at,
        purpose="password_reset"
    )

    db.add(otp_record)

    await db.commit()

    await asyncio.to_thread(
        send_otp_email,
        data.email,
        otp
    )

    resp = {
        "message": "If the email exists, a password reset OTP has been sent."
    }
    if not settings.SMTP_HOST or settings.SMTP_HOST == "smtp.example.com" or not settings.SMTP_USERNAME:
        resp["dev_otp"] = otp
    return resp


# =========================
# RESET PASSWORD
# =========================

@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):

    # 1. Find user
    result = await db.execute(
        select(User).where(User.email == data.email)
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid reset request"
        )

    # 2. Find latest password-reset OTP
    result = await db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.user_id == user.user_id,
            OTPVerification.purpose == "password_reset"
        )
        .order_by(
            OTPVerification.created_at.desc()
        )
    )

    otp_record = result.scalars().first()

    if otp_record is None:
        raise HTTPException(
            status_code=400,
            detail="Reset OTP not found"
        )

    # 3. Check expiry
    if datetime.utcnow() > otp_record.expires_at:
        await db.delete(otp_record)
        await db.commit()

        raise HTTPException(
            status_code=400,
            detail="Reset OTP has expired"
        )

    # 4. Verify OTP
    if not verify_password(
        data.otp,
        otp_record.otp_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP"
        )

    # 5. Hash new password
    user.password_hash = hash_password(
        data.new_password
    )

    # 6. Delete used OTP
    await db.delete(otp_record)

    # 7. Save changes
    await db.commit()

    return {
        "message": "Password reset successfully"
    }


# =========================
# CURRENT USER
# =========================

@router.get("/me")
async def get_current_user_info(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Patient).where(Patient.user_id == user.user_id)
    )
    patient = result.scalar_one_or_none()
    phone = patient.contact_number if patient else None

    return {
        "user_id": user.user_id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_verified": user.is_verified,
        "phone_number": phone
    }


@router.put("/me")
async def update_current_user_profile(
    data: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if data.full_name and data.full_name.strip():
        user.full_name = data.full_name.strip()

    if data.email and data.email.strip().lower() != user.email.lower():
        new_email = data.email.strip().lower()
        existing = await db.execute(
            select(User).where(User.email == new_email, User.user_id != user.user_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered by another account")
        user.email = new_email

    # Update or link Patient record for persistent phone number
    result = await db.execute(
        select(Patient).where(Patient.user_id == user.user_id)
    )
    patient = result.scalar_one_or_none()

    new_phone = data.phone_number.strip() if data.phone_number else None

    if patient:
        if data.full_name and data.full_name.strip():
            patient.full_name = data.full_name.strip()
        if new_phone:
            patient.contact_number = new_phone
    elif new_phone:
        patient = Patient(
            patient_id=f"P-{user.user_id}",
            user_id=user.user_id,
            full_name=user.full_name,
            age=25,
            gender="Not Specified",
            contact_number=new_phone
        )
        db.add(patient)

    await db.commit()
    await db.refresh(user)

    current_phone = patient.contact_number if patient else None

    return {
        "user_id": user.user_id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_verified": user.is_verified,
        "phone_number": current_phone,
        "message": "Profile updated successfully"
    }

@router.get("/debug-users")
async def debug_users(
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(User.user_id, User.email, User.is_verified)
    )

    users = result.all()

    return [
        {
            "user_id": row.user_id,
            "email": row.email,
            "is_verified": row.is_verified
        }
        for row in users
    ]