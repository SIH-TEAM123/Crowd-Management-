from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.article import (
    get_articles,
    get_article_by_id,
    get_article_by_slug,
)


router = APIRouter(
    prefix="/articles",
    tags=["Articles"],
)


@router.get("")
async def list_articles(
    category: Optional[str] = Query(
        default=None,
        max_length=100,
    ),
    search: Optional[str] = Query(
        default=None,
        max_length=150,
    ),
    wait_minutes: Optional[float] = Query(
        default=None,
        ge=0,
    ),
    db: AsyncSession = Depends(get_db),
):
    articles = await get_articles(
        db=db,
        category=category,
        search=search,
        wait_minutes=wait_minutes,
    )

    return {
        "count": len(articles),
        "articles": articles,
    }


@router.get("/slug/{slug}")
async def article_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_by_slug(
        db=db,
        slug=slug,
    )

    if article is None:
        raise HTTPException(
            status_code=404,
            detail="Article not found",
        )

    return article


@router.get("/{article_id}")
async def article_by_id(
    article_id: int,
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_by_id(
        db=db,
        article_id=article_id,
    )

    if article is None:
        raise HTTPException(
            status_code=404,
            detail="Article not found",
        )

    return article