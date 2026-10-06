"""
HTTP endpoints of the ideas module.
This work made by Anfinogentov Nikita
"""
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from modernsi.auth.deps import active_user, optional_user
from modernsi.core.db import get_db
from modernsi.core.deps import get_config, get_hub
from modernsi.core.ratelimit import hit
from modernsi.ideas import service
from modernsi.ideas.schemas import Category, IdeaCreate, IdeaDetail, IdeaPage, IdeaUpdate, Scope, Status

router = APIRouter(prefix="/api/ideas", tags=["ideas"])


@router.get("", response_model=IdeaPage)
async def ideas(
    status: list[Status] | None = Query(None),
    category: list[Category] | None = Query(None),
    scope: Scope | None = None,
    mine: Literal["authored", "voted", "team"] | None = None,
    sort: Literal["new", "trending", "closest"] = "new",
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    viewer=Depends(optional_user),
    db=Depends(get_db),
    settings=Depends(get_config),
):
    return await service.list_ideas(db, settings, viewer, status, category, scope, mine, sort, cursor, limit)


@router.post("", status_code=201, response_model=IdeaDetail)
async def create(data: IdeaCreate, user=Depends(active_user), db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, f"ideas:{user.id}", settings.rl_ideas_per_day, 86400)
    return await service.create_idea(db, settings, user, data)


@router.get("/{idea_id}", response_model=IdeaDetail)
async def read(idea_id: UUID, viewer=Depends(optional_user), db=Depends(get_db), settings=Depends(get_config)):
    return await service.get_detail(db, settings, idea_id, viewer)


@router.patch("/{idea_id}", response_model=IdeaDetail)
async def edit(idea_id: UUID, data: IdeaUpdate, user=Depends(active_user), db=Depends(get_db), settings=Depends(get_config)):
    return await service.update_idea(db, settings, user, idea_id, data)
