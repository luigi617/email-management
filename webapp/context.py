# email_context.py
import asyncio
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict

from dotenv import load_dotenv

from openmail import EmailManager
from ttl_cache import TTLCache
from email_service import load_accounts_from_db

load_dotenv(override=True)

MAX_WORKERS = int(os.getenv("THREADPOOL_WORKERS", "20"))

EXECUTOR = ThreadPoolExecutor(max_workers=MAX_WORKERS)

ACCOUNTS: Dict[str, EmailManager] = {}
_accounts_lock = threading.Lock()

MAILBOX_CACHE = TTLCache(ttl_seconds=60, maxsize=64)
MESSAGE_CACHE = TTLCache(ttl_seconds=600, maxsize=512)


async def run_blocking(fn, *args, **kwargs):
    """
    Run blocking IO in a bounded thread pool so the event loop remains responsive.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(EXECUTOR, lambda: fn(*args, **kwargs))


def reload_accounts_in_memory() -> None:
    global ACCOUNTS
    with _accounts_lock:
        ACCOUNTS.clear()
        ACCOUNTS.update(load_accounts_from_db())
