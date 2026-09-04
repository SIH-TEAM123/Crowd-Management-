from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.arcade_score import ArcadeScore
from app.models.user import User


router = APIRouter(prefix="/arcade", tags=["Arcade"])


class ArcadeScoreCreate(BaseModel):
    user_id: str = Field(min_length=1, max_length=3)
    token_id: str | None = Field(default=None, max_length=36)
    game_id: str = Field(min_length=1, max_length=50)
    score: int = Field(ge=0, le=1000)
    queue_session: str | None = Field(default=None, max_length=100)


ALLOWED_GAMES = {
    "reaction",
    "memory",
    "math",
    "color",
    "scramble",
    "odd",
    "pattern",
    "target",
    "signal",
    "token",
    "tetris",
}


@router.post("/scores")
async def submit_arcade_score(
    payload: ArcadeScoreCreate,
    db: AsyncSession = Depends(get_db),
):
    if payload.game_id not in ALLOWED_GAMES:
        raise HTTPException(
            status_code=400,
            detail="Invalid Arcade game.",
        )

    user_result = await db.execute(
        select(User).where(User.user_id == payload.user_id)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    score = ArcadeScore(
        user_id=user.user_id,
        token_id=payload.token_id,
        game_id=payload.game_id,
        score=payload.score,
        queue_session=payload.queue_session,
    )

    db.add(score)
    await db.commit()
    await db.refresh(score)

    return {
        "success": True,
        "score_id": score.score_id,
        "game_id": score.game_id,
        "score": score.score,
        "user_id": score.user_id,
        "created_at": score.created_at.isoformat(),
    }


@router.get("/leaderboard")
async def get_arcade_leaderboard(
    queue_session: str | None = None,
    game_id: str | None = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    limit = max(1, min(limit, 50))

    query = (
        select(
            ArcadeScore,
            User.full_name,
        )
        .join(
            User,
            User.user_id == ArcadeScore.user_id,
        )
    )

    if queue_session:
        query = query.where(
            ArcadeScore.queue_session == queue_session
        )

    if game_id:
        if game_id not in ALLOWED_GAMES:
            raise HTTPException(
                status_code=400,
                detail="Invalid Arcade game.",
            )

        query = query.where(
            ArcadeScore.game_id == game_id
        )

    query = (
        query
        .order_by(
            desc(ArcadeScore.score),
            ArcadeScore.created_at.asc(),
        )
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    leaderboard = []

    for rank, (score, full_name) in enumerate(rows, start=1):
        leaderboard.append(
            {
                "rank": rank,
                "user_id": score.user_id,
                "name": full_name,
                "token_id": score.token_id,
                "game_id": score.game_id,
                "score": score.score,
                "created_at": score.created_at.isoformat(),
            }
        )

    return {
        "success": True,
        "queue_session": queue_session,
        "game_id": game_id,
        "count": len(leaderboard),
        "leaderboard": leaderboard,
    }


@router.get("/scores/{user_id}")
async def get_user_arcade_scores(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(
        select(User).where(User.user_id == user_id)
    )

    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    result = await db.execute(
        select(ArcadeScore)
        .where(ArcadeScore.user_id == user_id)
        .order_by(
            desc(ArcadeScore.score),
            ArcadeScore.created_at.asc(),
        )
    )

    scores = result.scalars().all()

    best_by_game = {}

    for score in scores:
        if score.game_id not in best_by_game:
            best_by_game[score.game_id] = {
                "game_id": score.game_id,
                "score": score.score,
                "token_id": score.token_id,
                "queue_session": score.queue_session,
                "created_at": score.created_at.isoformat(),
            }

    return {
        "success": True,
        "user_id": user_id,
        "scores": list(best_by_game.values()),
    }
