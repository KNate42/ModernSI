"""
Admin endpoints. Every route here needs the admin role.
This work made by Anfinogentov Nikita
"""
from uuid import UUID

from fastapi import APIRouter, Depends

from modernsi.admin.schemas import (
    AdminUserOut, ApproveIn, DomainIn, DomainOut, DomainPatch, DomainRequestAdminOut, HiddenOut, ReportOut, RoleIn,
)
from modernsi.auth import service as auth_service
from modernsi.auth.deps import require_roles
from modernsi.campuses import service as campuses_service
from modernsi.core.db import get_db
from modernsi.core.deps import get_config, get_hub
from modernsi.ideas import service as ideas_service

admin_only = require_roles("admin")
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(admin_only)])


def admin_user_out(user):
    return {
        "id": user.id, "email": user.email, "display_name": user.display_name, "campus_label": user.campus_label,
        "role": user.role, "status": user.status, "created_at": user.created_at,
    }


@router.get("/domains", response_model=list[DomainOut])
async def domains(db=Depends(get_db)):
    return await campuses_service.list_domains(db)


@router.post("/domains", status_code=201, response_model=DomainOut)
async def add_domain(data: DomainIn, db=Depends(get_db)):
    return await campuses_service.add_domain(db, data.domain, data.campus_label, data.country_code)


@router.patch("/domains/{domain_id}", response_model=DomainOut)
async def patch_domain(domain_id: int, data: DomainPatch, db=Depends(get_db)):
    return await campuses_service.patch_domain(db, domain_id, data)


@router.get("/domain-requests", response_model=list[DomainRequestAdminOut])
async def domain_requests(status: str = "pending", db=Depends(get_db)):
    return await campuses_service.list_requests(db, status)


@router.post("/domain-requests/{request_id}/approve", response_model=DomainRequestAdminOut)
async def approve(request_id: int, data: ApproveIn, db=Depends(get_db), settings=Depends(get_config)):
    return await campuses_service.approve_request(db, settings, request_id, data.campus_label, data.country_code)


@router.post("/domain-requests/{request_id}/reject", response_model=DomainRequestAdminOut)
async def reject(request_id: int, db=Depends(get_db)):
    return await campuses_service.reject_request(db, request_id)


@router.get("/users", response_model=list[AdminUserOut])
async def users(q: str = "", db=Depends(get_db)):
    return [admin_user_out(user) for user in await auth_service.search_users(db, q)]


@router.put("/users/{user_id}/role", response_model=AdminUserOut)
async def set_role(user_id: UUID, data: RoleIn, db=Depends(get_db)):
    return admin_user_out(await auth_service.set_role(db, user_id, data.role))


@router.post("/users/{user_id}/block", response_model=AdminUserOut)
async def block(user_id: UUID, admin=Depends(admin_only), db=Depends(get_db), hub=Depends(get_hub)):
    return admin_user_out(await auth_service.block_user(db, hub, admin, user_id))


@router.post("/users/{user_id}/unblock", response_model=AdminUserOut)
async def unblock(user_id: UUID, db=Depends(get_db)):
    return admin_user_out(await auth_service.unblock_user(db, user_id))


@router.get("/reports", response_model=list[ReportOut])
async def reports(db=Depends(get_db)):
    return await ideas_service.list_reports(db)


@router.post("/reports/{report_id}/resolve")
async def resolve_report(report_id: int, db=Depends(get_db)):
    return await ideas_service.resolve_report(db, report_id)


@router.post("/ideas/{idea_id}/hide", response_model=HiddenOut)
async def hide_idea(idea_id: UUID, db=Depends(get_db)):
    return await ideas_service.set_hidden(db, idea_id, True)


@router.post("/ideas/{idea_id}/unhide", response_model=HiddenOut)
async def unhide_idea(idea_id: UUID, db=Depends(get_db)):
    return await ideas_service.set_hidden(db, idea_id, False)
