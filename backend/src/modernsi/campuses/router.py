"""
HTTP endpoints of the campuses module.
This work made by Anfinogentov Nikita
"""
from fastapi import APIRouter, Depends, Request

from modernsi.campuses import service
from modernsi.campuses.schemas import CampusOut, DomainRequestCreate, DomainRequestOut
from modernsi.core.db import get_db
from modernsi.core.deps import get_config, get_hub
from modernsi.core.ratelimit import hit
from modernsi.core.security import client_ip

router = APIRouter(prefix="/api/campuses", tags=["campuses"])


@router.post("/requests", status_code=201, response_model=DomainRequestOut)
async def request_domain(data: DomainRequestCreate, request: Request, db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, "domain_request:" + client_ip(request, settings), settings.rl_register_per_hour, 3600)
    row = await service.create_request(db, data)
    return {"id": row.id, "status": row.status}


@router.get("", response_model=list[CampusOut])
async def campuses(db=Depends(get_db)):
    return await service.list_campuses(db)
