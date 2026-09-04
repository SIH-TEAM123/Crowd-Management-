from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article


def article_to_dict(article: Article) -> dict:
    return {
        "article_id": article.article_id,
        "slug": article.slug,
        "title": article.title,
        "category": article.category,
        "summary": article.summary,
        "content": article.content,
        "reading_time_minutes": article.reading_time_minutes,
        "min_wait_minutes": article.min_wait_minutes,
        "max_wait_minutes": article.max_wait_minutes,
        "is_active": article.is_active,
        "created_at": (
            article.created_at.isoformat()
            if article.created_at
            else None
        ),
    }


async def get_articles(
    db: AsyncSession,
    category: Optional[str] = None,
    search: Optional[str] = None,
    wait_minutes: Optional[float] = None,
) -> list[dict]:
    query = select(Article).where(
        Article.is_active.is_(True)
    )

    if category:
        query = query.where(
            Article.category == category
        )

    if search:
        search_term = f"%{search.strip()}%"

        query = query.where(
            Article.title.ilike(search_term)
            | Article.summary.ilike(search_term)
            | Article.category.ilike(search_term)
        )

    result = await db.execute(query)
    articles = list(result.scalars().all())

    def score(article: Article) -> float:
        if wait_minutes is None:
            return 0.0

        minimum = article.min_wait_minutes
        maximum = article.max_wait_minutes

        if minimum is None and maximum is None:
            return 0.0

        if minimum is None:
            if wait_minutes <= maximum:
                return 100.0
            return max(
                0.0,
                100.0 - (wait_minutes - maximum) * 5.0
            )

        if maximum is None:
            if wait_minutes >= minimum:
                return 100.0
            return max(
                0.0,
                100.0 - (minimum - wait_minutes) * 5.0
            )

        if minimum <= wait_minutes <= maximum:
            return 100.0

        distance = (
            minimum - wait_minutes
            if wait_minutes < minimum
            else wait_minutes - maximum
        )

        return max(0.0, 100.0 - distance * 5.0)

    articles.sort(
        key=lambda article: (
            -score(article),
            article.reading_time_minutes,
            article.article_id,
        )
    )

    return [
        {
            **article_to_dict(article),
            "fit_score": round(score(article), 1),
            "recommended": (
                wait_minutes is not None
                and score(article) >= 80.0
            ),
        }
        for article in articles
    ]


async def get_article_by_id(
    db: AsyncSession,
    article_id: int,
) -> Optional[dict]:
    result = await db.execute(
        select(Article).where(
            Article.article_id == article_id,
            Article.is_active.is_(True),
        )
    )

    article = result.scalar_one_or_none()

    if article is None:
        return None

    return article_to_dict(article)


async def get_article_by_slug(
    db: AsyncSession,
    slug: str,
) -> Optional[dict]:
    result = await db.execute(
        select(Article).where(
            Article.slug == slug,
            Article.is_active.is_(True),
        )
    )

    article = result.scalar_one_or_none()

    if article is None:
        return None

    return article_to_dict(article)
