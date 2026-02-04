import asyncio
import io
import mimetypes
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Dict, List, Optional, Tuple
from urllib.parse import unquote

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware

from accounts_api import router as accounts_router, set_reload_callback
from email_overview import build_email_overview
from email_service import init_db, load_accounts_from_db
from openmail import EmailManager
from openmail.models import EmailMessage
from openmail.types import EmailRef
from ttl_cache import TTLCache
from utils import build_extra_headers, safe_filename, uploadfiles_to_attachments


from email_api import router as email_router
from context import ACCOUNTS, EXECUTOR, reload_accounts_in_memory


load_dotenv(override=True)

BASE = Path(__file__).parent
MAX_WORKERS = int(os.getenv("THREADPOOL_WORKERS", "20"))


# ---------------------------
# App lifecycle
# ---------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    reload_accounts_in_memory()
    yield
    EXECUTOR.shutdown(wait=False)


app = FastAPI(lifespan=lifespan)

# ---------------------------
# Middleware / routing
# ---------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

set_reload_callback(reload_accounts_in_memory)
app.include_router(accounts_router)
app.include_router(email_router)



# ---------------------------
# Static SPA hosting
# ---------------------------
FRONTEND_DIR = BASE / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
    app.mount("/static", StaticFiles(directory=DIST_DIR), name="static")

    @app.get("/{path:path}")
    async def spa(path: str):
        """
        Serve the SPA index for any non-API route.
        """
        if path.startswith("api/") or path == "api":
            raise HTTPException(status_code=404, detail="Not found")

        candidate = DIST_DIR / path
        if path and candidate.is_file():
            return FileResponse(candidate)

        return FileResponse(DIST_DIR / "index.html")
