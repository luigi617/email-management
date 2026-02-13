# auth.py
import os
import secrets
from typing import Iterable, Literal, Optional

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware

AUTH_MODE = os.getenv("AUTH_MODE", "required").lower()
APP_USER = os.getenv("APP_USER", "me")
APP_PASSWORD = os.getenv("APP_PASSWORD", "")
SESSION_SECRET = os.getenv("SESSION_SECRET", "")

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true").lower() in ("1", "true", "yes", "on")
COOKIE_SAMESITE = os.getenv(
    "COOKIE_SAMESITE", "lax"
)  # "lax" is usually correct for SPA + same-site API

AUTH_ENABLED = AUTH_MODE == "required"

if AUTH_ENABLED:
    if not SESSION_SECRET:
        raise RuntimeError("Set SESSION_SECRET in .env (long random string)")
    if not APP_PASSWORD:
        raise RuntimeError("Set APP_PASSWORD in .env")


def verify_password(plain: str) -> bool:
    return secrets.compare_digest(plain, APP_PASSWORD)


router = APIRouter(prefix="/api", tags=["auth"])


class AuthStatus(BaseModel):
    mode: Literal["open", "required"]
    authed: Optional[bool] = None


@router.get("/auth/status", response_model=AuthStatus)
async def auth_status(request: Request):
    if not AUTH_ENABLED:
        return {"mode": "open"}
    authed = request.session.get("authed") is True
    return {"mode": "required", "authed": authed}


class LoginBody(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginBody, request: Request):
    user_ok = secrets.compare_digest(body.username, APP_USER)
    pass_ok = verify_password(body.password)
    if not (user_ok and pass_ok):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    request.session["authed"] = True
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True}


class SessionAuthGateMiddleware(BaseHTTPMiddleware):
    """
    Protect API routes (and optionally the SPA) using the session cookie.
    """

    def __init__(
        self,
        app,
        open_api_paths: Iterable[str] = ("/api/login", "/api/logout", "/api/auth/status"),
        protect_spa: bool = False,
        open_spa_prefixes: Iterable[str] = ("/assets/", "/static/"),
    ):
        super().__init__(app)
        self.open_api_paths = set(open_api_paths)
        self.protect_spa = protect_spa
        self.open_spa_prefixes = tuple(open_spa_prefixes)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Allow public assets regardless
        if path.startswith(self.open_spa_prefixes):
            return await call_next(request)
        # API protection
        if path.startswith("/api/"):
            if path in self.open_api_paths:
                return await call_next(request)
            if request.session.get("authed") is True:
                return await call_next(request)
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)

        # Optional SPA protection (gates "/" and any non-API routes)
        if self.protect_spa:
            if request.session.get("authed") is True:
                return await call_next(request)
            # Frontend can detect 401 and show login UI
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)

        return await call_next(request)


def setup_auth(app: FastAPI) -> None:
    app.include_router(router)

    if not AUTH_ENABLED:
        return

    app.add_middleware(SessionAuthGateMiddleware, protect_spa=False)
    app.add_middleware(
        SessionMiddleware,
        secret_key=SESSION_SECRET,
        max_age=None,
        same_site=COOKIE_SAMESITE,
        https_only=COOKIE_SECURE,  # set COOKIE_SECURE=false on localhost http
    )
