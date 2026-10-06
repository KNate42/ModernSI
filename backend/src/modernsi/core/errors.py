"""
One error shape for the whole API: {"error": {"code", "message"}}. Store outages become 503.
This work made by Anfinogentov Nikita
"""
import logging

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymongo.errors import ServerSelectionTimeoutError
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError
from sqlalchemy.exc import InterfaceError, OperationalError
from starlette.exceptions import HTTPException

log = logging.getLogger("modernsi")


class api_error(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def error_body(code, message, **extra):
    return {"error": {"code": code, "message": message, **extra}}


def install_error_handlers(app):
    @app.exception_handler(api_error)
    async def on_api_error(request, exc):
        return JSONResponse(error_body(exc.code, exc.message), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def on_validation(request, exc):
        fields = []
        for item in exc.errors():
            # loc looks like ("body", "name") or ("query", "limit"); the first part is noise for the client
            location = [str(part) for part in item["loc"][1:]] or [str(item["loc"][0])]
            fields.append({"field": ".".join(location), "message": item["msg"]})
        return JSONResponse(error_body("validation_error", "Some fields are invalid", fields=fields), status_code=422)

    @app.exception_handler(HTTPException)
    async def on_http(request, exc):
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return JSONResponse(error_body(code, str(exc.detail)), status_code=exc.status_code)

    async def on_store_down(request, exc):
        log.warning("store unavailable: %r", exc)
        return JSONResponse(error_body("store_unavailable", "A service is temporarily unavailable, try again shortly"), status_code=503)

    for kind in (RedisConnectionError, RedisTimeoutError, OperationalError, InterfaceError, ServerSelectionTimeoutError, ConnectionRefusedError):
        app.add_exception_handler(kind, on_store_down)
