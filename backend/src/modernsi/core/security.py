"""
Request guards: Origin check for every mutating API call and the real client IP for rate limits.
This work made by Anfinogentov Nikita
"""
from fastapi.responses import JSONResponse

from modernsi.core.errors import error_body

safe_methods = {"GET", "HEAD", "OPTIONS"}


def install_origin_check(app, settings):
    allowed = set(settings.allowed_origins)

    @app.middleware("http")
    async def origin_check(request, call_next):
        # SameSite=Lax already stops most CSRF; the Origin check closes the rest for POST/PUT/PATCH/DELETE
        if request.method not in safe_methods and request.url.path.startswith("/api/"):
            if request.headers.get("origin") not in allowed:
                return JSONResponse(error_body("bad_origin", "Request origin is not allowed"), status_code=403)
        return await call_next(request)


def client_ip(request, settings):
    forwarded = request.headers.get("x-forwarded-for")
    if settings.trust_forwarded_for and forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
