"""
HTTP endpoints of the profiles module.
This work made by Anfinogentov Nikita
"""
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import Response

from modernsi.auth.deps import active_user, current_user
from modernsi.auth.service import get_public_user
from modernsi.core.db import get_db
from modernsi.core.deps import get_hub
from modernsi.profiles import service
from modernsi.profiles.schemas import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/me", response_model=ProfileOut)
async def my_profile(user=Depends(current_user), hub=Depends(get_hub)):
    return await service.get_profile(hub, user)


@router.put("/me", response_model=ProfileOut)
async def update_my_profile(data: ProfileUpdate, user=Depends(active_user), hub=Depends(get_hub)):
    return await service.update_profile(hub, user, data)


@router.put("/me/avatar", status_code=204)
async def upload_avatar(file: UploadFile, user=Depends(active_user), hub=Depends(get_hub)):
    content = await file.read(service.max_avatar + 1)
    await service.set_avatar(hub, user, content)


@router.get("/{user_id}", response_model=ProfileOut)
async def profile(user_id: UUID, db=Depends(get_db), hub=Depends(get_hub)):
    return await service.get_profile(hub, await get_public_user(db, user_id))


@router.get("/{user_id}/avatar")
async def avatar(user_id: UUID, hub=Depends(get_hub)):
    content, content_type = await service.get_avatar(hub, user_id)
    return Response(content, media_type=content_type, headers={"Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff"})
