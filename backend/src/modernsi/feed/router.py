"""
HTTP endpoints of the feed module.
This work made by Anfinogentov Nikita
"""
from fastapi import APIRouter, Depends, Query

from modernsi.auth.deps import optional_user
from modernsi.core.db import get_db
from modernsi.core.deps import get_config, get_hub
from modernsi.core.errors import api_error
from modernsi.feed import service
from modernsi.feed.schemas import FeedPage, StatsOut

router = APIRouter(prefix="/api", tags=["feed"])


@router.get("/feed", response_model=FeedPage)
async def feed(cursor: str | None = None, limit: int = Query(20, ge=1, le=50), mine: bool = False, user=Depends(optional_user), db=Depends(get_db), hub=Depends(get_hub)):
    if mine and user is None:
        raise api_error(401, "not_authenticated", "Please log in first")
    return await service.list_feed(hub, db, cursor, limit, actor_id=user.id if mine else None)


@router.get("/stats", response_model=StatsOut)
async def stats(hub=Depends(get_hub), settings=Depends(get_config)):
    return await service.stats(hub, settings)
