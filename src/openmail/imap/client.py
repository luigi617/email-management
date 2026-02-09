# openmail/imap/client.py
from __future__ import annotations

import imaplib
import re
import ssl
import threading
import time
from collections import OrderedDict
from contextlib import contextmanager
from dataclasses import dataclass, field
from email.message import EmailMessage as PyEmailMessage
from email.parser import BytesParser
from email.policy import default as default_policy
from queue import Empty, Queue
from typing import Callable, Dict, List, Optional, Sequence, Set, Tuple, TypeVar

from openmail import IMAPConfig
from openmail.auth import AuthContext
from openmail.errors import ConfigError, IMAPError
from openmail.imap.attachment_parts import fetch_part_bytes
from openmail.imap.bodystructure import (
    extract_bodystructure_from_fetch_meta,
    extract_text_and_attachments,
    parse_bodystructure,
    pick_best_text_parts,
)
from openmail.imap.fetch_response import (
    has_header_peek,
    iter_fetch_pieces,
    match_section_body,
    match_section_mime,
    parse_flags,
    parse_internaldate,
    parse_uid,
)
from openmail.imap.inline_cid import inline_cids_as_data_uris
from openmail.imap.pagination import PagedSearchResult
from openmail.imap.parser import (
    decode_body_chunk,
    parse_headers_and_bodies,
    parse_overview,
)
from openmail.imap.query import IMAPQuery
from openmail.models import AttachmentMeta, EmailMessage, EmailOverview
from openmail.types import EmailRef
from openmail.utils import parse_list_mailbox_name

REPLACE_ON = (imaplib.IMAP4.abort, TimeoutError, OSError, ssl.SSLError)

T = TypeVar("T")


@dataclass
class _ConnState:
    conn: imaplib.IMAP4
    selected_mailbox: Optional[str] = None
    selected_readonly: Optional[bool] = None


@dataclass
class _CacheEntry:
    expires_at: float
    uids: List[int]


class _TTL_LRU_Cache:
    """
    Small, dependency-free TTL + LRU cache.
    Keys: (mailbox, criteria_str)
    Values: list[int] (ascending UIDs)
    """

    def __init__(self, *, max_keys: int, ttl_seconds: float):
        self._max_keys = max_keys
        self._ttl = ttl_seconds
        self._d: "OrderedDict[tuple[str, str], _CacheEntry]" = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: tuple[str, str]) -> Optional[List[int]]:
        now = time.time()
        with self._lock:
            ent = self._d.get(key)
            if ent is None:
                return None
            if ent.expires_at < now:
                self._d.pop(key, None)
                return None
            self._d.move_to_end(key)
            return ent.uids

    def set(self, key: tuple[str, str], uids: List[int]) -> None:
        now = time.time()
        with self._lock:
            self._d[key] = _CacheEntry(expires_at=now + self._ttl, uids=uids)
            self._d.move_to_end(key)
            while len(self._d) > self._max_keys:
                self._d.popitem(last=False)

    def invalidate(self, mailbox: Optional[str] = None) -> None:
        with self._lock:
            if mailbox is None:
                self._d.clear()
                return
            keys = [k for k in self._d.keys() if k[0] == mailbox]
            for k in keys:
                self._d.pop(k, None)


@dataclass
class _UIDWindow:
    start: int  # inclusive
    end: int    # inclusive


@dataclass
class IMAPClient:
    config: IMAPConfig

    # ---- perf knobs ----
    pool_size: int = 2                    # 2–4 is usually plenty
    max_concurrent_searches: int = 1      # keep SEARCH serialized-ish
    max_retries: int = 1
    backoff_seconds: float = 0.2

    # ---- cache knobs ----
    cache_ttl_seconds: float = 60.0
    cache_max_keys: int = 256
    max_uids_per_key: int = 10_000        # cap UID list size stored

    # ---- progressive SEARCH knobs ----
    search_window_factor: int = 4         # initial window ~= page_size * factor
    search_max_rounds: int = 6            # window doubles each round
    search_max_window_uids: int = 200_000 # hard guard against huge UID SEARCH windows

    _pool: "Queue[_ConnState]" = field(default_factory=Queue, init=False, repr=False)
    _pool_lock: threading.Lock = field(default_factory=threading.Lock, init=False, repr=False)
    pool_acquire_timeout: float = 5.0

    _search_sem: threading.Semaphore = field(init=False, repr=False)
    _search_cache: _TTL_LRU_Cache = field(init=False, repr=False)

    @classmethod
    def from_config(cls, config: IMAPConfig) -> "IMAPClient":
        if not config.host:
            raise ConfigError("IMAP host required")
        if not config.port:
            raise ConfigError("IMAP port required")
        return cls(config)

    def __post_init__(self) -> None:
        self._search_sem = threading.Semaphore(self.max_concurrent_searches)
        self._search_cache = _TTL_LRU_Cache(
            max_keys=self.cache_max_keys,
            ttl_seconds=self.cache_ttl_seconds,
        )

        # initialize pool
        for _ in range(max(1, self.pool_size)):
            self._pool.put(_ConnState(self._open_new_connection()))

    # -----------------------
    # Connection management
    # -----------------------

    def _open_new_connection(self) -> imaplib.IMAP4:
        cfg = self.config
        try:
            conn = (
                imaplib.IMAP4_SSL(cfg.host, cfg.port, timeout=cfg.timeout)
                if cfg.use_ssl
                else imaplib.IMAP4(cfg.host, cfg.port, timeout=cfg.timeout)
            )

            if cfg.auth is None:
                raise ConfigError("IMAPConfig.auth is required (PasswordAuth or OAuth2Auth)")

            cfg.auth.apply_imap(conn, AuthContext(host=cfg.host, port=cfg.port))
            return conn

        except imaplib.IMAP4.error as e:
            raise IMAPError(f"IMAP connection/auth failed: {e}") from e
        except OSError as e:
            raise IMAPError(f"IMAP network error: {e}") from e

    def _replace_bad_conn(self, state: _ConnState) -> _ConnState:
        try:
            state.conn.logout()
        except Exception:
            pass
        return _ConnState(self._open_new_connection())

    @contextmanager
    def _acquire(self):
        state = self._pool.get(timeout=self.pool_acquire_timeout)
        try:
            yield state
            self._pool.put(state)
        except REPLACE_ON:
            new_state = self._replace_bad_conn(state)
            self._pool.put(new_state)
            raise
        except Exception:
            self._pool.put(state)
            raise

    def _run(self, op: Callable[[_ConnState], T]) -> T:
        """
        Run an operation with retries. Pool handles reconnect by replacing bad conns.
        """
        last_exc: Optional[BaseException] = None
        retryable = (imaplib.IMAP4.abort, TimeoutError, OSError, ssl.SSLError)

        for attempt in range(self.max_retries + 1):
            try:
                with self._acquire() as state:
                    return op(state)
            except Empty as e:
                # pool exhausted / deadlock upstream
                raise IMAPError("IMAP connection pool exhausted") from e
            except retryable as e:
                last_exc = e
                if attempt < self.max_retries and self.backoff_seconds > 0:
                    time.sleep(self.backoff_seconds)
                continue
            except imaplib.IMAP4.error as e:
                raise IMAPError(f"IMAP operation failed: {e}") from e

        raise IMAPError(f"IMAP operation failed after retries: {last_exc}") from last_exc

    def _run_search(self, op: Callable[[_ConnState], T]) -> T:
        # throttle searches
        with self._search_sem:
            return self._run(op)

    # -----------------------
    # Mailbox selection helpers
    # -----------------------

    def _format_mailbox_arg(self, mailbox: str) -> str:
        if mailbox.upper() == "INBOX":
            return "INBOX"
        if mailbox.startswith('"') and mailbox.endswith('"'):
            return mailbox
        return f'"{mailbox}"'

    def _ensure_selected(self, state: _ConnState, mailbox: str, readonly: bool) -> None:
        """
        Per-connection SELECT cache.
        RW selection satisfies both RW and RO.
        RO satisfies only RO.
        """
        if state.selected_mailbox == mailbox:
            if state.selected_readonly is False:
                return
            if readonly and state.selected_readonly is True:
                return

        imap_mailbox = self._format_mailbox_arg(mailbox)
        typ, _ = state.conn.select(imap_mailbox, readonly=readonly)
        if typ != "OK":
            raise IMAPError(f"select({mailbox!r}, readonly={readonly}) failed")

        state.selected_mailbox = mailbox
        state.selected_readonly = readonly

    def _assert_same_mailbox(self, refs: Sequence[EmailRef], op_name: str) -> str:
        if not refs:
            raise IMAPError(f"{op_name} called with empty refs")
        mailbox = refs[0].mailbox
        for r in refs:
            if r.mailbox != mailbox:
                raise IMAPError(
                    f"All EmailRef.mailbox must match for {op_name} "
                    f"(got {refs[0].mailbox!r} and {r.mailbox!r})"
                )
        return mailbox

    # -----------------------
    # Cache invalidation
    # -----------------------

    def _invalidate_search_cache(self, mailbox: Optional[str] = None) -> None:
        self._search_cache.invalidate(mailbox)

    # -----------------------
    # LIST parsing
    # -----------------------

    def _parse_list_flags(self, raw: bytes) -> Set[str]:
        try:
            s = raw.decode(errors="ignore")
        except Exception:
            return set()

        start = s.find("(")
        end = s.find(")", start + 1)
        if start == -1 or end == -1 or end <= start + 1:
            return set()

        flags_str = s[start + 1 : end].strip()
        if not flags_str:
            return set()

        return {f.upper() for f in flags_str.split() if f.strip()}

    # -----------------------
    # Progressive SEARCH helpers
    # -----------------------

    def _clone_query(self, base: IMAPQuery) -> IMAPQuery:
        return IMAPQuery(parts=list(base.parts))

    def _uidnext(self, state: _ConnState, mailbox: str) -> int:
        """
        Return UIDNEXT for mailbox via STATUS (cheap).
        """
        imap_mailbox = self._format_mailbox_arg(mailbox)
        typ, data = state.conn.status(imap_mailbox, "(UIDNEXT)")
        if typ != "OK" or not data or not data[0]:
            raise IMAPError(f"STATUS UIDNEXT failed for {mailbox!r}: {data}")

        raw = data[0].decode(errors="ignore") if isinstance(data[0], bytes) else str(data[0])
        m = re.search(r"UIDNEXT\s+(\d+)", raw)
        if not m:
            raise IMAPError(f"Could not parse UIDNEXT from STATUS response: {raw!r}")
        return int(m.group(1))

    def _make_window(
        self,
        *,
        state: _ConnState,
        mailbox: str,
        before_uid: Optional[int],
        after_uid: Optional[int],
        window_size: int,
    ) -> _UIDWindow:
        """
        Create a finite UID window [start:end] inclusive.
        - before_uid: want UIDs < before_uid (older)
        - after_uid: want UIDs > after_uid (newer)
        - neither: want newest page (tail window near UIDNEXT-1)
        """
        if before_uid is not None and after_uid is not None:
            raise ValueError("Cannot specify both before_uid and after_uid")

        if before_uid is not None:
            end = max(1, before_uid - 1)
            start = max(1, end - window_size + 1)
            return _UIDWindow(start=start, end=end)

        uidnext = self._uidnext(state, mailbox)
        newest = max(1, uidnext - 1)

        if after_uid is not None:
            start = after_uid + 1
            end = min(newest, start + window_size - 1)
            end = max(end, start) if newest >= start else start - 1  # empty window if beyond newest
            return _UIDWindow(start=start, end=end)

        # initial page: tail window
        end = newest
        start = max(1, end - window_size + 1)
        return _UIDWindow(start=start, end=end)

    def _search_in_window(
        self,
        *,
        state: _ConnState,
        mailbox: str,
        base_query: IMAPQuery,
        win: _UIDWindow,
    ) -> Tuple[str, List[int]]:
        """
        Run UID SEARCH for (base_query AND UID start:end). Returns (criteria_str, uids_asc).
        """
        q = self._clone_query(base_query)

        # empty window
        if win.end < win.start:
            criteria = q.build() or "ALL"
            return criteria, []

        q.uid(f"{win.start}:{win.end}")
        criteria = q.build() or "ALL"

        self._ensure_selected(state, mailbox, readonly=True)

        typ, data = state.conn.uid("SEARCH", None, criteria)
        if typ != "OK":
            raise IMAPError(f"SEARCH failed: {data}")

        raw = data[0] or b""
        uids = [int(x) for x in raw.split() if x]
        return criteria, uids  # server returns ascending

    def _refresh_search_cache_progressive(
        self,
        *,
        mailbox: str,
        query: IMAPQuery,
        page_size: int,
        before_uid: Optional[int],
        after_uid: Optional[int],
    ) -> Tuple[str, List[int]]:
        """
        Progressive widening UID-window SEARCH.
        Returns (criteria_str_used_for_cache, uids_asc).
        """
        def _impl(state: _ConnState) -> Tuple[str, List[int]]:
            want = max(1, page_size)
            window_size = max(want * self.search_window_factor, want)

            last_criteria = query.build() or "ALL"
            last_uids: List[int] = []

            for _round in range(self.search_max_rounds):
                window_size = min(window_size, self.search_max_window_uids)

                win = self._make_window(
                    state=state,
                    mailbox=mailbox,
                    before_uid=before_uid,
                    after_uid=after_uid,
                    window_size=window_size,
                )

                criteria, uids = self._search_in_window(
                    state=state,
                    mailbox=mailbox,
                    base_query=query,
                    win=win,
                )

                last_criteria = criteria
                last_uids = uids

                # enough to fill the page: stop early
                if len(uids) >= want:
                    break

                # hit the bottom boundary for older/tail: cannot expand further
                if before_uid is not None or (before_uid is None and after_uid is None):
                    if win.start == 1:
                        break

                # hit the top boundary for newer: cannot expand further
                if after_uid is not None:
                    uidnext = self._uidnext(state, mailbox)
                    newest = max(1, uidnext - 1)
                    if win.end >= newest:
                        break

                # widen window and retry
                window_size *= 2

            # memory guard: keep tail (most useful for "older" paging)
            if len(last_uids) > self.max_uids_per_key:
                last_uids = last_uids[-self.max_uids_per_key :]

            return last_criteria, last_uids

        return self._run_search(_impl)

    # -----------------------
    # SEARCH + pagination
    # -----------------------

    def refresh_search_cache(self, *, mailbox: str, query: IMAPQuery) -> List[int]:
        """
        Legacy: unbounded criteria search (still windowed if query already includes UID).
        Prefer search_page_cached() which uses progressive windows automatically.
        """
        criteria = query.build() or "ALL"

        def _impl(state: _ConnState) -> List[int]:
            self._ensure_selected(state, mailbox, readonly=True)
            typ, data = state.conn.uid("SEARCH", None, criteria)
            if typ != "OK":
                raise IMAPError(f"SEARCH failed: {data}")

            raw = data[0] or b""
            uids = [int(x) for x in raw.split() if x]

            if len(uids) > self.max_uids_per_key:
                uids = uids[-self.max_uids_per_key :]
            return uids

        return self._run_search(_impl)

    def search_page_cached(
        self,
        *,
        mailbox: str,
        query: IMAPQuery,
        page_size: int = 50,
        before_uid: Optional[int] = None,
        after_uid: Optional[int] = None,
        refresh: bool = False,
    ) -> PagedSearchResult:
        """
        Efficient paging: uses progressive widening UID windows to avoid huge SEARCH responses.
        Cache key includes the *actual* criteria string used (including UID range).
        """
        if before_uid is not None and after_uid is not None:
            raise ValueError("Cannot specify both before_uid and after_uid")

        # Always compute the progressive window result when refresh=True,
        # otherwise try cache (but we need the exact criteria key).
        if refresh:
            criteria, uids = self._refresh_search_cache_progressive(
                mailbox=mailbox,
                query=query,
                page_size=page_size,
                before_uid=before_uid,
                after_uid=after_uid,
            )
            cache_key = (mailbox, criteria)
            self._search_cache.set(cache_key, uids)
        else:
            # We still need the criteria key; we compute it via progressive search once
            # (it’s the same work we’d do on cache-miss).
            criteria, uids = self._refresh_search_cache_progressive(
                mailbox=mailbox,
                query=query,
                page_size=page_size,
                before_uid=before_uid,
                after_uid=after_uid,
            )
            cache_key = (mailbox, criteria)
            cached = self._search_cache.get(cache_key)
            if cached is not None:
                uids = cached
            else:
                self._search_cache.set(cache_key, uids)

        if not uids:
            return PagedSearchResult(refs=[], total=0, has_next=False, has_prev=False)

        # uids are ascending
        if before_uid is not None:
            page_uids_asc = uids[-page_size:]     # newest among “older”
        elif after_uid is not None:
            page_uids_asc = uids[:page_size]      # oldest among “newer”
        else:
            page_uids_asc = uids[-page_size:]     # newest overall

        if not page_uids_asc:
            return PagedSearchResult(refs=[], total=0, has_next=False, has_prev=False)

        refs = [EmailRef(uid=u, mailbox=mailbox) for u in reversed(page_uids_asc)]
        oldest_uid = page_uids_asc[0]
        newest_uid = page_uids_asc[-1]

        # These flags are "best effort" within the current window.
        # Global has_older/has_newer is unknown without extra probes.
        known_more_in_window = len(uids) > len(page_uids_asc)

        if before_uid is not None:
            has_older = known_more_in_window or (oldest_uid > 1)
            has_newer = True
        elif after_uid is not None:
            has_newer = known_more_in_window
            has_older = True
        else:
            has_older = known_more_in_window or (oldest_uid > 1)
            has_newer = False

        return PagedSearchResult(
            refs=refs,
            next_before_uid=oldest_uid if has_older else None,
            prev_after_uid=newest_uid if has_newer else None,
            newest_uid=newest_uid,
            oldest_uid=oldest_uid,
            total=len(uids),  # window total, not global total
            has_next=has_older,
            has_prev=has_newer,
        )

    def search(self, *, mailbox: str, query: IMAPQuery, limit: int = 50) -> List[EmailRef]:
        page = self.search_page_cached(
            mailbox=mailbox,
            query=query,
            page_size=limit,
            refresh=True,
        )
        return page.refs

    # -----------------------
    # FETCH helpers
    # -----------------------

    def _fetch_section_mime_and_body(
        self, state: _ConnState, *, uid: int, section: str
    ) -> Tuple[Optional[bytes], Optional[bytes]]:
        want = f"(UID BODY.PEEK[{section}.MIME] BODY.PEEK[{section}])"
        typ, data = state.conn.uid("FETCH", str(uid), want)
        if typ != "OK":
            raise IMAPError(f"FETCH body section failed uid={uid}: {data}")

        mime_bytes: Optional[bytes] = None
        body_bytes: Optional[bytes] = None

        for piece in iter_fetch_pieces(data or []):
            sec_mime = match_section_mime(piece.meta)
            sec_body = match_section_body(piece.meta)

            if piece.payload is None:
                continue

            if sec_mime:
                mime_bytes = piece.payload
            elif sec_body:
                body_bytes = piece.payload

        return mime_bytes, body_bytes

    def _decode_section(self, *, mime_bytes: Optional[bytes], body_bytes: Optional[bytes]) -> str:
        if not body_bytes:
            return ""
        if not mime_bytes:
            try:
                return body_bytes.decode("utf-8", errors="replace")
            except Exception:
                return body_bytes.decode("latin-1", errors="replace")

        msg = BytesParser(policy=default_policy).parsebytes(mime_bytes)
        return decode_body_chunk(body_bytes, msg)

    # -----------------------
    # FETCH full message
    # -----------------------

    def fetch(self, refs: Sequence[EmailRef], *, include_attachment_meta: bool = False) -> List[EmailMessage]:
        if not refs:
            return []

        mailbox = self._assert_same_mailbox(refs, "fetch")
        required_uids = {r.uid for r in refs}

        def _impl(state: _ConnState) -> List[EmailMessage]:
            self._ensure_selected(state, mailbox, readonly=True)

            uid_str = ",".join(str(r.uid) for r in refs)
            attrs = "(UID INTERNALDATE BODYSTRUCTURE BODY.PEEK[HEADER])"
            typ, data = state.conn.uid("FETCH", uid_str, attrs)
            if typ != "OK":
                raise IMAPError(f"FETCH failed: {data}")
            if not data:
                return []

            partial: Dict[int, Dict[str, object]] = {}
            current_uid: Optional[int] = None

            for piece in iter_fetch_pieces(data):
                uid = parse_uid(piece.meta)
                if uid is not None:
                    current_uid = uid if uid in required_uids else None
                if current_uid is None:
                    continue

                bucket = partial.setdefault(
                    current_uid,
                    {"headers": None, "internaldate": None, "bodystructure": None},
                )

                internal = parse_internaldate(piece.meta)
                if internal:
                    bucket["internaldate"] = internal

                if has_header_peek(piece.meta) and piece.payload is not None:
                    bucket["headers"] = piece.payload

                bs = extract_bodystructure_from_fetch_meta(piece.meta)
                if bs:
                    bucket["bodystructure"] = bs

            out: List[EmailMessage] = []
            for r in refs:
                info = partial.get(r.uid)
                if not info:
                    continue

                header_bytes = info.get("headers") or b""
                internaldate_raw = info.get("internaldate")
                bs_raw = info.get("bodystructure")

                text = ""
                html = ""
                attachment_metas: List[AttachmentMeta] = []

                if isinstance(bs_raw, str) and bs_raw:
                    try:
                        tree = parse_bodystructure(bs_raw)
                        text_parts, atts = extract_text_and_attachments(tree)
                        plain_ref, html_ref = pick_best_text_parts(text_parts)

                        if include_attachment_meta:
                            attachment_metas = atts

                        if plain_ref is not None:
                            mime_b, body_b = self._fetch_section_mime_and_body(
                                state, uid=r.uid, section=plain_ref.part
                            )
                            text = self._decode_section(mime_bytes=mime_b, body_bytes=body_b)

                        if html_ref is not None:
                            mime_b, body_b = self._fetch_section_mime_and_body(
                                state, uid=r.uid, section=html_ref.part
                            )
                            html = self._decode_section(mime_bytes=mime_b, body_bytes=body_b)

                        if html and attachment_metas:
                            html = inline_cids_as_data_uris(
                                conn=state.conn,
                                uid=r.uid,
                                html=html,
                                attachment_metas=attachment_metas,
                            )
                    except Exception:
                        pass

                msg = parse_headers_and_bodies(
                    r,
                    header_bytes,
                    text=text,
                    html=html,
                    attachments=attachment_metas if include_attachment_meta else [],
                    internaldate_raw=(internaldate_raw if isinstance(internaldate_raw, str) else None),
                )
                out.append(msg)

            return out

        return self._run(_impl)

    # -----------------------
    # FETCH overview
    # -----------------------

    def fetch_overview(self, refs: Sequence[EmailRef]) -> List[EmailOverview]:
        if not refs:
            return []
        mailbox = self._assert_same_mailbox(refs, "fetch_overview")

        def _impl(state: _ConnState) -> List[EmailOverview]:
            self._ensure_selected(state, mailbox, readonly=True)

            uid_str = ",".join(str(r.uid) for r in refs)
            attrs = (
                "(UID FLAGS INTERNALDATE "
                "BODY.PEEK[HEADER.FIELDS (From To Subject Date Message-ID Content-Type Content-Transfer-Encoding)])"
            )
            typ, data = state.conn.uid("FETCH", uid_str, attrs)
            if typ != "OK":
                raise IMAPError(f"FETCH overview failed: {data}")
            if not data:
                return []

            partial: Dict[int, Dict[str, object]] = {}
            current_uid: Optional[int] = None

            for piece in iter_fetch_pieces(data):
                uid = parse_uid(piece.meta)
                if uid is not None:
                    current_uid = uid
                if current_uid is None:
                    continue

                bucket = partial.setdefault(
                    current_uid,
                    {"flags": set(), "headers": None, "internaldate": None},
                )

                bucket["flags"] = parse_flags(piece.meta) or bucket["flags"]

                internal = parse_internaldate(piece.meta)
                if internal:
                    bucket["internaldate"] = internal

                if piece.payload is not None:
                    bucket["headers"] = piece.payload

            overviews: List[EmailOverview] = []
            for r in refs:
                info = partial.get(r.uid)
                if not info:
                    continue

                flags = set(info["flags"]) if isinstance(info["flags"], set) else set()
                header_bytes = info.get("headers") or b""
                internaldate_raw = info.get("internaldate")

                overviews.append(
                    parse_overview(
                        r,
                        flags,
                        header_bytes,
                        internaldate_raw=(internaldate_raw if isinstance(internaldate_raw, str) else None),
                    )
                )

            return overviews

        return self._run(_impl)

    # -----------------------
    # Attachment fetch
    # -----------------------

    def fetch_attachment(self, ref: EmailRef, attachment_part: str) -> bytes:
        mailbox = ref.mailbox
        uid = ref.uid
        part = attachment_part

        def _impl(state: _ConnState) -> bytes:
            self._ensure_selected(state, mailbox, readonly=True)
            return fetch_part_bytes(state.conn, uid=uid, part=part)

        return self._run(_impl)

    # -----------------------
    # Mutations
    # -----------------------

    def append(self, mailbox: str, msg: PyEmailMessage, *, flags: Optional[Set[str]] = None) -> EmailRef:
        def _impl(state: _ConnState) -> EmailRef:
            self._ensure_selected(state, mailbox, readonly=False)

            flags_arg = "(" + " ".join(sorted(flags)) + ")" if flags else None
            date_time = imaplib.Time2Internaldate(time.time())
            raw_bytes = msg.as_bytes()
            imap_mailbox = self._format_mailbox_arg(mailbox)

            typ, data = state.conn.append(imap_mailbox, flags_arg, date_time, raw_bytes)
            if typ != "OK":
                raise IMAPError(f"APPEND to {mailbox!r} failed: {data}")

            uid: Optional[int] = None
            if data and data[0]:
                resp = data[0].decode(errors="ignore") if isinstance(data[0], bytes) else str(data[0])
                m = re.search(r"APPENDUID\s+\d+\s+(\d+)", resp)
                if m:
                    uid = int(m.group(1))

            if uid is None:
                typ_search, data_search = state.conn.uid("SEARCH", None, "ALL")
                if typ_search == "OK" and data_search and data_search[0]:
                    all_uids = [int(x) for x in data_search[0].split() if x.strip()]
                    uid = max(all_uids) if all_uids else None

            if uid is None:
                raise IMAPError("APPEND succeeded but could not determine UID")

            return EmailRef(uid=uid, mailbox=mailbox)

        ref = self._run(_impl)
        self._invalidate_search_cache(mailbox)
        return ref

    def add_flags(self, refs: Sequence[EmailRef], *, flags: Set[str]) -> None:
        self._store(refs, mode="+FLAGS", flags=flags)

    def remove_flags(self, refs: Sequence[EmailRef], *, flags: Set[str]) -> None:
        self._store(refs, mode="-FLAGS", flags=flags)

    def _store(self, refs: Sequence[EmailRef], *, mode: str, flags: Set[str]) -> None:
        if not refs:
            return
        mailbox = self._assert_same_mailbox(refs, "_store")

        def _impl(state: _ConnState) -> None:
            self._ensure_selected(state, mailbox, readonly=False)
            uids = ",".join(str(r.uid) for r in refs)
            flag_list = "(" + " ".join(sorted(flags)) + ")"
            typ, data = state.conn.uid("STORE", uids, mode, flag_list)
            if typ != "OK":
                raise IMAPError(f"STORE failed: {data}")

        self._run(_impl)
        self._invalidate_search_cache(mailbox)

    def expunge(self, mailbox: str = "INBOX") -> None:
        def _impl(state: _ConnState) -> None:
            self._ensure_selected(state, mailbox, readonly=False)
            typ, data = state.conn.expunge()
            if typ != "OK":
                raise IMAPError(f"EXPUNGE failed: {data}")

        self._run(_impl)
        self._invalidate_search_cache(mailbox)

    # -----------------------
    # Mailboxes
    # -----------------------

    def list_mailboxes(self) -> List[str]:
        def _impl(state: _ConnState) -> List[str]:
            typ, data = state.conn.list()
            if typ != "OK":
                raise IMAPError(f"LIST failed: {data}")

            mailboxes: List[str] = []
            for raw in data or []:
                if not raw:
                    continue

                flags = self._parse_list_flags(raw)
                if r"\NOSELECT" in flags:
                    continue

                name = parse_list_mailbox_name(raw)
                if name is not None:
                    mailboxes.append(name)

            return mailboxes

        return self._run(_impl)

    def mailbox_status(self, mailbox: str = "INBOX") -> Dict[str, int]:
        def _impl(state: _ConnState) -> Dict[str, int]:
            imap_mailbox = self._format_mailbox_arg(mailbox)

            typ, data = state.conn.status(
                imap_mailbox,
                "(MESSAGES UNSEEN UIDNEXT UIDVALIDITY HIGHESTMODSEQ)",
            )
            if typ != "OK":
                raise IMAPError(f"STATUS {mailbox!r} failed: {data}")
            if not data or not data[0]:
                raise IMAPError(f"STATUS {mailbox!r} returned empty data")

            raw = data[0]
            s = raw.decode(errors="ignore") if isinstance(raw, bytes) else str(raw)

            start = s.find("(")
            end = s.rfind(")")
            if start == -1 or end == -1 or end <= start:
                raise IMAPError(f"Unexpected STATUS response: {s!r}")

            payload = s[start + 1 : end]
            tokens = payload.split()

            status: Dict[str, int] = {}
            for i in range(0, len(tokens) - 1, 2):
                key = tokens[i].upper()
                try:
                    val = int(tokens[i + 1])
                except ValueError:
                    continue

                if key == "MESSAGES":
                    status["messages"] = val
                elif key == "UNSEEN":
                    status["unseen"] = val
                elif key == "UIDNEXT":
                    status["uidnext"] = val
                elif key == "UIDVALIDITY":
                    status["uidvalidity"] = val
                elif key == "HIGHESTMODSEQ":
                    status["highestmodseq"] = val
                else:
                    status[key.lower()] = val

            return status

        return self._run(_impl)

    def move(self, refs: Sequence[EmailRef], *, src_mailbox: str, dst_mailbox: str) -> None:
        if not refs:
            return
        for r in refs:
            if r.mailbox != src_mailbox:
                raise IMAPError("All EmailRef.mailbox must match src_mailbox for move()")

        def _impl(state: _ConnState) -> None:
            self._ensure_selected(state, src_mailbox, readonly=False)

            uids = ",".join(str(r.uid) for r in refs)
            dst_arg = self._format_mailbox_arg(dst_mailbox)

            typ, data = state.conn.uid("MOVE", uids, dst_arg)
            if typ == "OK":
                return

            typ_copy, data_copy = state.conn.uid("COPY", uids, dst_arg)
            if typ_copy != "OK":
                raise IMAPError(f"COPY (for MOVE fallback) failed: {data_copy}")

            typ_store, data_store = state.conn.uid("STORE", uids, "+FLAGS.SILENT", r"(\Deleted)")
            if typ_store != "OK":
                raise IMAPError(f"STORE +FLAGS.SILENT \\Deleted failed: {data_store}")

            typ_expunge, data_expunge = state.conn.expunge()
            if typ_expunge != "OK":
                raise IMAPError(f"EXPUNGE (after MOVE fallback) failed: {data_expunge}")

        self._run(_impl)
        self._invalidate_search_cache(src_mailbox)
        self._invalidate_search_cache(dst_mailbox)

    def copy(self, refs: Sequence[EmailRef], *, src_mailbox: str, dst_mailbox: str) -> None:
        if not refs:
            return
        for r in refs:
            if r.mailbox != src_mailbox:
                raise IMAPError("All EmailRef.mailbox must match src_mailbox for copy()")

        def _impl(state: _ConnState) -> None:
            self._ensure_selected(state, src_mailbox, readonly=False)

            uids = ",".join(str(r.uid) for r in refs)
            dst_arg = self._format_mailbox_arg(dst_mailbox)
            typ, data = state.conn.uid("COPY", uids, dst_arg)
            if typ != "OK":
                raise IMAPError(f"COPY failed: {data}")

        self._run(_impl)
        self._invalidate_search_cache(dst_mailbox)

    def create_mailbox(self, name: str) -> None:
        def _impl(state: _ConnState) -> None:
            imap_name = self._format_mailbox_arg(name)
            typ, data = state.conn.create(imap_name)
            if typ != "OK":
                raise IMAPError(f"CREATE {name!r} failed: {data}")

        self._run(_impl)
        self._invalidate_search_cache()

    def delete_mailbox(self, name: str) -> None:
        def _impl(state: _ConnState) -> None:
            imap_name = self._format_mailbox_arg(name)
            typ, data = state.conn.delete(imap_name)
            if typ != "OK":
                raise IMAPError(f"DELETE {name!r} failed: {data}")

        self._run(_impl)
        self._invalidate_search_cache()

    def ping(self) -> None:
        def _impl(state: _ConnState) -> None:
            typ, data = state.conn.noop()
            if typ != "OK":
                raise IMAPError(f"NOOP failed: {data}")

        self._run(_impl)

    def close(self) -> None:
        # drain and close all conns
        with self._pool_lock:
            while not self._pool.empty():
                state = self._pool.get_nowait()
                try:
                    state.conn.logout()
                except Exception:
                    pass

    def __enter__(self) -> "IMAPClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()
