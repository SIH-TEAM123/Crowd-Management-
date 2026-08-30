import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.token import Token, TokenStatus, PriorityType
from app.models.user import User
from app.utils.auth import get_current_user
from app.services.p4_fairness import run_fairness_for_queue


router = APIRouter(
    prefix="/tokens",
    tags=["Tokens"],
)


class TokenCreateRequest(BaseModel):
    priority_type: str = "NORMAL"
    expiry_minutes: Optional[int] = 60
    admin_configured_service_time_minutes: int = 10
    active_counters: int = 1


@router.post("")
async def create_token(
    request: TokenCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ---------------------------------------------------------
    # 1. Validate priority type
    # ---------------------------------------------------------
    try:
        priority = PriorityType(request.priority_type.upper())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid priority_type. "
                "Use NORMAL, VULNERABLE, or TIME_CRITICAL."
            ),
        )

    # ---------------------------------------------------------
    # 2. Find current waiting tokens
    # ---------------------------------------------------------
    result = await db.execute(
        select(Token).where(
            Token.token_status == TokenStatus.WAITING
        )
    )

    waiting_tokens = result.scalars().all()

    queue_position = len(waiting_tokens) + 1

    # ---------------------------------------------------------
    # 3. Generate unique token ID
    # ---------------------------------------------------------
    token_id = str(uuid.uuid4())

    # ---------------------------------------------------------
    # 4. Generate today's token number
    # ---------------------------------------------------------
    today_start = datetime.utcnow().replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    result = await db.execute(
        select(Token).where(
            Token.token_created_at >= today_start
        )
    )

    today_tokens = result.scalars().all()

    token_number = f"A{len(today_tokens) + 1:03d}"

    # ---------------------------------------------------------
    # 5. Calculate token expiry
    # ---------------------------------------------------------
    now = datetime.utcnow()

    token_expires_at = None

    if request.expiry_minutes is not None:
        token_expires_at = now + timedelta(
            minutes=request.expiry_minutes
        )

    # ---------------------------------------------------------
    # 6. Create new token
    # ---------------------------------------------------------
    new_token = Token(
        token_id=token_id,
        token_number=token_number,
        user_id=current_user.user_id,
        anonymous_user_id=None,
        display_name=current_user.full_name,
        token_status=TokenStatus.WAITING,
        queue_position=queue_position,
        priority_type=priority,
        token_created_at=now,
        service_started_at=None,
        service_completed_at=None,
        admin_configured_service_time_minutes=(
            request.admin_configured_service_time_minutes
        ),
        active_counters=request.active_counters,
        expiry_minutes=request.expiry_minutes,
        token_expires_at=token_expires_at,
    )

    # ---------------------------------------------------------
    # 7. Save token to database
    # ---------------------------------------------------------
    db.add(new_token)

    await db.commit()
    await db.refresh(new_token)

    # ---------------------------------------------------------
    # 8. Run Person-4 fairness + crowd + emergency pipeline
    # ---------------------------------------------------------
    fairness_result = await run_fairness_for_queue(
        people_count=len(waiting_tokens) + 1,
        waiting_tokens=waiting_tokens + [new_token],
        active_counters=request.active_counters,
        facility_id="HOSPITAL_001",
    )

    # ---------------------------------------------------------
    # 9. Return token + Person-4 decision data
    # ---------------------------------------------------------
    return {
        "message": "Token generated successfully",

        "token_id": new_token.token_id,
        "token_number": new_token.token_number,
        "user_id": new_token.user_id,
        "display_name": new_token.display_name,

        "token_status": new_token.token_status,
        "queue_position": new_token.queue_position,
        "priority_type": new_token.priority_type,

        "token_created_at": new_token.token_created_at,
        "token_expires_at": new_token.token_expires_at,

        # Person-4 fairness result
        "fairness": fairness_result["decision_result"].fairness,

        # Complete optimizer decision
        "decision": fairness_result["decision_result"],

        # Sanitized camera/crowd information
        "crowd_state": fairness_result["sanitized_crowd_state"],

        # Emergency information
        "emergency_state": fairness_result["emergency_state"],
    }