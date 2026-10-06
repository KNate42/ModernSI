"""
Health endpoint: tells which stores answer. 503 only when Postgres, the source of truth, is down.
This work made by Anfinogentov Nikita
"""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from modernsi.core.deps import get_hub

router = APIRouter()


@router.get("/api/health")
async def health(hub=Depends(get_hub)):
    state = await hub.health()
    status = "ok" if all(state.values()) else "degraded"
    return JSONResponse({"status": status, "stores": state}, status_code=200 if state["postgres"] else 503)
