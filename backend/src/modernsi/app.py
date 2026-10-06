"""
Builds the FastAPI application: stores on startup, middleware, error handlers and every module router.
This work made by Anfinogentov Nikita
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from modernsi.admin.router import router as admin_router
from modernsi.auth.router import router as auth_router
from modernsi.campuses.router import router as campuses_router
from modernsi.core.config import get_settings
from modernsi.core.errors import install_error_handlers
from modernsi.core.health import router as health_router
from modernsi.core.security import install_origin_check
from modernsi.core.stores import stores
from modernsi.feed.schema import ensure_schema


def routers():
    # There I keep every module router in one list; each module task appends its own line
    return [health_router, campuses_router, auth_router, admin_router]


def create_app(settings=None):
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app):
        hub = stores(settings)
        client = await hub.get_clickhouse()
        if client is not None:
            await ensure_schema(client)
        app.state.stores = hub
        yield
        await hub.close()

    app = FastAPI(title="ModernSI API", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
    app.state.settings = settings
    install_error_handlers(app)
    install_origin_check(app, settings)
    for router in routers():
        app.include_router(router)
    return app
