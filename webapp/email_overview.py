from __future__ import annotations

import asyncio
import copy
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from model import select_email_provider_and_models
from ttl_cache import TTLCache
from utils import decode_cursor, encode_cursor

from openmail import EmailAssistant, EmailManager, EmailQuery
from openmail.imap import IMAPQuery
from openmail.models import EmailOverview

_OVERVIEW_RESPONSE_CACHE = TTLCache(ttl_seconds=15, maxsize=512)
IS_AI_MODEL_AVAILABLE = select_email_provider_and_models()[0] is not None


@dataclass
class _CachedDerivedQuery:
    created_at: float
    query_snapshot: IMAPQuery
    debug_repr: str


# Replaces _DerivedIMAPQueryCache with TTLCache directly
_DERIVED_QUERY_CACHE = TTLCache(ttl_seconds=3600, maxsize=256)


def _apply_cached_query(base_q: EmailQuery, cached: _CachedDerivedQuery) -> None:
    base_q.query = copy.deepcopy(cached.query_snapshot)


def _normalize_search(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    ss = " ".join(s.strip().split())
    return ss if ss else None


def _normalize_ai_cache_key(s: str) -> str:
    return " ".join(s.strip().split()).lower()


def _cache_key(
    *,
    mailbox: str,
    limit: int,
    cursor: Optional[str],
    account_ids: List[str],
    search_query: Optional[str],
) -> str:
    acc_key = ",".join(account_ids)
    sq = search_query or ""
    return f"mb={mailbox}|lim={limit}|cursor={cursor or ''}|acc={acc_key}|q={sq}"


async def build_email_overview(
    *,
    mailbox: str = "INBOX",
    limit: int = 50,
    search_query: Optional[str] = None,
    cursor: Optional[str] = None,
    accounts: Optional[List[str]] = None,
    ACCOUNTS: Dict[str, EmailManager],
    run_blocking,
) -> dict:

    if limit < 1:
        raise ValueError("limit must be >= 1")

    if cursor:
        cursor_state = decode_cursor(cursor)
        mailbox = cursor_state["mailbox"]
        account_state: Dict[str, Dict[str, Optional[int]]] = cursor_state["accounts"]
        account_ids = list(account_state.keys())
        search_query = cursor_state.get("search_query")
    else:
        if accounts is None:
            account_ids = list(ACCOUNTS.keys())
        else:
            account_ids = accounts

        account_state = {acc_id: {"next_before_uid": None} for acc_id in account_ids}

    if not account_ids:
        return {}

    normalized_search = _normalize_search(search_query)

    key = _cache_key(
        mailbox=mailbox,
        limit=limit,
        cursor=cursor,
        account_ids=account_ids,
        search_query=normalized_search,
    )
    cached_resp = _OVERVIEW_RESPONSE_CACHE.get(key)
    if cached_resp is not None:
        return cached_resp

    managers: Dict[str, EmailManager] = {}
    for acc_id in account_ids:
        manager = ACCOUNTS.get(acc_id)
        if manager is None:
            raise KeyError(f"Unknown account: {acc_id}")
        managers[acc_id] = manager


    cached_ai: Optional[_CachedDerivedQuery] = None

    if normalized_search and IS_AI_MODEL_AVAILABLE:
        ai_key = _normalize_ai_cache_key(normalized_search)
        cached_ai = _DERIVED_QUERY_CACHE.get(ai_key)

        if cached_ai is None:
            provider, models = select_email_provider_and_models()
            email_assistant = EmailAssistant()
            easy_imap_query, _ = email_assistant.search_emails(
                normalized_search,
                provider=provider,
                model_name=models.fast,
            )
            snap = copy.deepcopy(easy_imap_query.query)
            try:
                debug_repr = str(easy_imap_query.query)
            except Exception:
                debug_repr = ""

            cached_ai = _CachedDerivedQuery(
                created_at=time.time(),
                query_snapshot=snap,
                debug_repr=debug_repr,
            )
            _DERIVED_QUERY_CACHE.set(ai_key, cached_ai)

    async def _fetch_one_account(acc_id: str) -> Tuple[str, int, List[EmailOverview]]:
        manager = managers[acc_id]
        state = account_state.get(acc_id, {"next_before_uid": None})
        before_uid = state.get("next_before_uid")

        q = manager.imap_query(mailbox).limit(limit)

        if normalized_search:
            if IS_AI_MODEL_AVAILABLE and cached_ai is not None:
                _apply_cached_query(q, cached_ai)
            else:
                q.query = q.query.or_(
                    IMAPQuery().subject(normalized_search),
                    IMAPQuery().text(normalized_search),
                    IMAPQuery().to(normalized_search),
                    IMAPQuery().from_(normalized_search),
                )


        try:
            page_meta, overview_list = await run_blocking(
                q.fetch_overview,
                before_uid=before_uid,
                after_uid=None,
            )
        except Exception:
            return acc_id, 0, []

        return acc_id, int(page_meta.total), overview_list

    combined_entries: List[Tuple[str, EmailOverview]] = []
    total_count = 0

    # ---------- Parallel fetch across accounts ----------
    results = await asyncio.gather(
        *(_fetch_one_account(acc_id) for acc_id in account_ids),
        return_exceptions=False,
    )

    for acc_id, acc_total, overview_list in results:
        total_count += acc_total
        for ov in overview_list:
            combined_entries.append((acc_id, ov))

    def _unique_sort_key(pair: Tuple[str, EmailOverview]) -> Tuple[datetime, str, int]:
        acc_id, ov = pair
        dt = ov.received_at or datetime.min.replace(tzinfo=timezone.utc)
        uid = ov.ref.uid or -1
        return (dt, acc_id, uid)

    combined_entries.sort(key=_unique_sort_key, reverse=True)
    page_entries = combined_entries[:limit]

    result_count = len(page_entries)

    contributed: Dict[str, List[EmailOverview]] = {}
    for acc_id, ov in page_entries:
        contributed.setdefault(acc_id, []).append(ov)

    data: List[dict] = []
    for acc_id, ov in page_entries:
        d = ov.to_dict()
        ref: dict = d["ref"]
        ref.setdefault("account", acc_id)
        data.append(d)

    # ---------- Build next anchors per account ----------
    new_state_accounts: Dict[str, Dict[str, Optional[int]]] = {}

    for acc_id in account_ids:
        prev_state = account_state.get(acc_id, {"next_before_uid": None})
        state = {"next_before_uid": prev_state.get("next_before_uid")}

        contrib_list = contributed.get(acc_id, [])
        if contrib_list:
            uids = [ov.ref.uid for ov in contrib_list]
            uids = [u for u in uids if u is not None]
            if uids:
                oldest_uid = min(uids)
                state["next_before_uid"] = max(oldest_uid, 1)

        new_state_accounts[acc_id] = state

    any_has_next = result_count > 0 and any(
        s.get("next_before_uid") is not None for s in new_state_accounts.values()
    )

    next_cursor = None
    if result_count > 0 and any_has_next:
        next_cursor_state = {
            "mailbox": mailbox,
            "limit": limit,
            "accounts": new_state_accounts,
            "search_query": normalized_search,
        }
        next_cursor = encode_cursor(next_cursor_state)

    resp = {
        "data": data,
        "meta": {
            "next_cursor": next_cursor,
            "result_count": result_count,
            "total_count": total_count,
        },
    }

    _OVERVIEW_RESPONSE_CACHE.set(key, resp)
    return resp
