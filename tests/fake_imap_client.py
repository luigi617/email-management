# tests/fake_imap_client.py

from __future__ import annotations

from dataclasses import dataclass, field
from email.message import EmailMessage as PyEmailMessage
from typing import Dict, List, Optional, Sequence, Set, Tuple

from openmail.errors import IMAPError
from openmail.imap.pagination import PagedSearchResult
from openmail.imap.parser import parse_overview, parse_rfc822
from openmail.imap.query import IMAPQuery
from openmail.models import EmailMessage, EmailOverview
from openmail.types import EmailRef


@dataclass
class _StoredMessage:
    msg: EmailMessage
    flags: Set[str]


@dataclass
class FakeIMAPClient:
    """
    In-memory IMAP client for testing.

    Keeps the public API compatible with the current IMAPClient surface:
      - search_page (progressive window semantics)
      - search (returns List[EmailRef])
      - fetch / fetch_overview / fetch_attachment
      - append / flag ops / mailbox ops / copy / move / expunge / ping / close / ctx manager

    Notes vs old Fake:
      - SEARCH caching removed (real IMAPClient).
      - PagedSearchResult.total is "window total" (not global total), matching real client.
    """

    config: Optional[object] = None

    # mailbox -> uid -> _StoredMessage
    _mailboxes: Dict[str, Dict[int, _StoredMessage]] = field(default_factory=dict)
    _next_uid: int = 1

    # If True, the next IMAP operation will raise IMAPError (for error paths).
    fail_next: bool = False

    # --- internal helpers -------------------------------------------------

    def _ensure_mailbox(self, name: str) -> Dict[int, _StoredMessage]:
        return self._mailboxes.setdefault(name, {})

    def _alloc_uid(self) -> int:
        uid = self._next_uid
        self._next_uid += 1
        return uid

    def _maybe_fail(self) -> None:
        if self.fail_next:
            self.fail_next = False
            raise IMAPError("FakeIMAPClient forced failure")

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

    # --- message cloning helpers -----------------------------------------

    def _clone_message_with_ref(self, msg: EmailMessage, new_ref: EmailRef) -> EmailMessage:
        # Rebuild EmailMessage to ensure `ref` is correct and nothing keeps old mailbox/uid.
        return EmailMessage(
            ref=new_ref,
            subject=msg.subject,
            from_email=msg.from_email,
            to=msg.to,
            cc=msg.cc,
            bcc=msg.bcc,
            text=msg.text,
            html=msg.html,
            attachments=list(msg.attachments),
            received_at=msg.received_at,
            sent_at=msg.sent_at,
            message_id=msg.message_id,
            headers=dict(msg.headers),
        )

    # --- test helpers -----------------------------------------------------

    def add_parsed_message(
        self,
        mailbox: str,
        msg: EmailMessage,
        *,
        flags: Optional[Set[str]] = None,
    ) -> EmailRef:
        """
        Seed a mailbox with an existing EmailMessage model. Returns the EmailRef used to store it.
        """
        self._maybe_fail()
        box = self._ensure_mailbox(mailbox)
        uid = self._alloc_uid()
        ref = EmailRef(uid=uid, mailbox=mailbox)

        stored_msg = self._clone_message_with_ref(msg, ref)
        box[uid] = _StoredMessage(stored_msg, set(flags or set()))
        return ref

    # --- SEARCH + pagination (matches current IMAPClient surface) ---------

    def _matches_query(self, stored: _StoredMessage, parts: List[str]) -> bool:
        """
        Very small subset of IMAP SEARCH semantics:

        - UNSEEN / SEEN
        - DELETED / UNDELETED
        - DRAFT / UNDRAFT
        - FLAGGED / UNFLAGGED
        - HEADER "List-Unsubscribe" "" (header present)

        Everything else is ignored (accept).
        """
        flags = stored.flags
        msg = stored.msg

        # Flags-based filters
        if "UNSEEN" in parts and r"\Seen" in flags:
            return False
        if "SEEN" in parts and r"\Seen" not in flags:
            return False
        if "DELETED" in parts and r"\Deleted" not in flags:
            return False
        if "UNDELETED" in parts and r"\Deleted" in flags:
            return False
        if "DRAFT" in parts and r"\Draft" not in flags:
            return False
        if "UNDRAFT" in parts and r"\Draft" in flags:
            return False
        if "FLAGGED" in parts and r"\Flagged" not in flags:
            return False
        if "UNFLAGGED" in parts and r"\Flagged" in flags:
            return False

        # Simple header presence/value check:
        # IMAPQuery.header("List-Unsubscribe", "")
        for i, token in enumerate(parts):
            if token == "HEADER" and i + 2 < len(parts):
                name_token = parts[i + 1].strip('"')
                value_token = parts[i + 2].strip('"')
                if name_token.lower() == "list-unsubscribe":
                    has_header = any(
                        k.lower() == "list-unsubscribe" for k in (msg.headers or {}).keys()
                    )
                    if value_token == "":
                        if not has_header:
                            return False
                    else:
                        header_val = (msg.headers or {}).get("List-Unsubscribe", "") or ""
                        if value_token.lower() not in header_val.lower():
                            return False

        return True

    def _matching_uids_asc(self, *, mailbox: str, query: IMAPQuery) -> Tuple[str, List[int]]:
        """
        Return (criteria_str, matching_uids_asc) for the mailbox/query.
        """
        criteria = query.build() or "ALL"
        box = self._mailboxes.get(mailbox, {})
        parts = query.parts

        uids: List[int] = []
        for uid in sorted(box.keys()):
            if self._matches_query(box[uid], parts):
                uids.append(uid)
        return criteria, uids

    def search_page(
        self,
        *,
        mailbox: str,
        query: IMAPQuery,
        page_size: int = 50,
        before_uid: Optional[int] = None,
        after_uid: Optional[int] = None,
    ) -> PagedSearchResult:
        """
        Mirrors current IMAPClient.search_page contract:
          - Returned refs are newest-first for the page.
          - total is "window total" (not global total), matching real progressive-search client.
        """
        self._maybe_fail()
        if before_uid is not None and after_uid is not None:
            raise ValueError("Cannot specify both before_uid and after_uid")

        _criteria, all_uids = self._matching_uids_asc(mailbox=mailbox, query=query)
        if not all_uids:
            return PagedSearchResult(refs=[], total=0, has_next=False, has_prev=False)

        # Define the "window" similar to the real client semantics.
        if before_uid is not None:
            window_uids = [u for u in all_uids if u < before_uid]
        elif after_uid is not None:
            window_uids = [u for u in all_uids if u > after_uid]
        else:
            # Real client uses a tail window that widens progressively; for the fake,
            # we just treat the whole match-set as the window.
            window_uids = all_uids

        if not window_uids:
            return PagedSearchResult(refs=[], total=0, has_next=False, has_prev=False)

        # uids are ascending
        if before_uid is not None:
            page_uids_asc = window_uids[-page_size:]
        elif after_uid is not None:
            page_uids_asc = window_uids[:page_size]
        else:
            page_uids_asc = window_uids[-page_size:]

        if not page_uids_asc:
            return PagedSearchResult(
                refs=[], total=len(window_uids), has_next=False, has_prev=False
            )

        refs = [EmailRef(uid=u, mailbox=mailbox) for u in reversed(page_uids_asc)]

        oldest_uid = page_uids_asc[0]
        newest_uid = page_uids_asc[-1]
        known_more_in_window = len(window_uids) > len(page_uids_asc)

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
            total=len(window_uids),  # window total (not global total)
            has_next=has_older,
            has_prev=has_newer,
        )

    def search(self, *, mailbox: str, query: IMAPQuery, limit: int = 50) -> List[EmailRef]:
        page = self.search_page(mailbox=mailbox, query=query, page_size=limit)
        return page.refs

    def uid_search(self, *, mailbox: str, query: IMAPQuery) -> List[int]:
        """
        Mirror IMAPClient.uid_search():
        single SEARCH with the given query (no progressive windowing).
        Returns ascending UIDs.
        """
        self._maybe_fail()
        _criteria, uids = self._matching_uids_asc(mailbox=mailbox, query=query)
        return uids

    # --- FETCH full message ----------------------------------------------

    def fetch(
        self,
        refs: Sequence[EmailRef],
        *,
        include_attachment_meta: bool = False,
    ) -> List[EmailMessage]:
        self._maybe_fail()
        if not refs:
            return []

        mailbox = self._assert_same_mailbox(refs, "fetch")
        box = self._mailboxes.get(mailbox, {})

        out: List[EmailMessage] = []
        for r in refs:
            stored = box.get(r.uid)
            if not stored:
                continue

            msg = stored.msg
            if include_attachment_meta:
                out.append(msg)
            else:
                out.append(
                    EmailMessage(
                        ref=msg.ref,
                        subject=msg.subject,
                        from_email=msg.from_email,
                        to=msg.to,
                        cc=msg.cc,
                        bcc=msg.bcc,
                        text=msg.text,
                        html=msg.html,
                        attachments=[],
                        received_at=msg.received_at,
                        sent_at=msg.sent_at,
                        message_id=msg.message_id,
                        headers=dict(msg.headers),
                    )
                )
        return out

    # --- FETCH overview ---------------------------------------------------

    def fetch_overview(self, refs: Sequence[EmailRef]) -> List[EmailOverview]:
        """
        Mirrors IMAPClient.fetch_overview() surface by returning EmailOverview.
        We synthesize minimal header bytes and call parse_overview() (same helper as real IMAPClient).
        """
        self._maybe_fail()
        if not refs:
            return []

        mailbox = self._assert_same_mailbox(refs, "fetch_overview")
        box = self._mailboxes.get(mailbox, {})

        out: List[EmailOverview] = []
        for r in refs:
            stored = box.get(r.uid)
            if not stored:
                continue

            msg = stored.msg
            flags = set(stored.flags)

            def _add_header(hdr_lines: List[str], name: str, value: Optional[str]) -> None:
                if not value:  # covers None and ""
                    return
                hdr_lines.append(f"{name}: {value}")

            hdr_lines: List[str] = []
            _add_header(hdr_lines, "From", (msg.headers or {}).get("From") or msg.from_email)
            _add_header(
                hdr_lines,
                "To",
                (msg.headers or {}).get("To") or (", ".join(msg.to) if msg.to else None),
            )
            _add_header(hdr_lines, "Subject", (msg.headers or {}).get("Subject") or msg.subject)
            _add_header(
                hdr_lines,
                "Date",
                (msg.headers or {}).get("Date")
                or (msg.received_at.isoformat() if msg.received_at else None),
            )
            _add_header(
                hdr_lines, "Message-ID", (msg.headers or {}).get("Message-ID") or msg.message_id
            )

            # Preserve other headers best-effort (avoid duplicates for the main ones).
            used = {h.split(":", 1)[0].lower() for h in hdr_lines}
            for k, v in (msg.headers or {}).items():
                if k.lower() in used:
                    continue
                if v is None:
                    continue
                hdr_lines.append(f"{k}: {v}")

            header_bytes = ("\r\n".join(hdr_lines) + "\r\n\r\n").encode("utf-8", errors="replace")
            out.append(parse_overview(r, flags, header_bytes, internaldate_raw=None))

        return out

    def fetch_message_id(self, ref: EmailRef) -> Optional[str]:
        """
        Mirror IMAPClient.fetch_message_id():
        returns the parsed Message-ID for a single message, or None.
        """
        self._maybe_fail()
        box = self._mailboxes.get(ref.mailbox, {})
        stored = box.get(ref.uid)
        if not stored:
            return None

        msg = stored.msg

        # Prefer normalized field on the model
        mid = msg.message_id
        if isinstance(mid, str) and mid.strip():
            return mid.strip()

        # Fall back to headers
        hdr_mid = (msg.headers or {}).get("Message-ID") or (msg.headers or {}).get("Message-Id")
        if isinstance(hdr_mid, str) and hdr_mid.strip():
            return hdr_mid.strip()

        return None

    # --- Attachment fetch -------------------------------------------------

    def fetch_attachment(self, ref: EmailRef, attachment_part: str) -> bytes:
        """
        Best-effort attachment retrieval.

        Looks inside stored EmailMessage.attachments for a matching `.part`
        and returns bytes from `.data` if present.
        """
        self._maybe_fail()
        box = self._mailboxes.get(ref.mailbox, {})
        stored = box.get(ref.uid)
        if not stored:
            raise IMAPError(f"Message not found for {ref!r}")

        msg = stored.msg
        for att in msg.attachments:
            if getattr(att, "part", None) != attachment_part:
                continue

            val = getattr(att, "data", None)
            if isinstance(val, (bytes, bytearray)):
                return bytes(val)

            if isinstance(att, (bytes, bytearray)):
                return bytes(att)

            raise IMAPError(
                f"Attachment found for part={attachment_part!r} but no byte payload "
                f"(expected .data as bytes)"
            )

        raise IMAPError(f"Attachment part not found: uid={ref.uid} part={attachment_part}")

    # --- Mutations --------------------------------------------------------

    def append(
        self,
        mailbox: str,
        msg: PyEmailMessage,
        *,
        flags: Optional[Set[str]] = None,
    ) -> EmailRef:
        """
        Behaves similarly to IMAPClient.append(): parses RFC822 and stores with a new UID.
        """
        self._maybe_fail()
        box = self._ensure_mailbox(mailbox)
        uid = self._alloc_uid()
        ref = EmailRef(uid=uid, mailbox=mailbox)

        raw = msg.as_bytes()
        parsed = parse_rfc822(ref, raw, include_attachments=True)
        box[uid] = _StoredMessage(parsed, set(flags or set()))
        return ref

    def add_flags(self, refs: Sequence[EmailRef], *, flags: Set[str]) -> None:
        self._maybe_fail()
        if not refs:
            return
        mailbox = self._assert_same_mailbox(refs, "add_flags")
        box = self._mailboxes.get(mailbox, {})
        for r in refs:
            stored = box.get(r.uid)
            if stored:
                stored.flags |= set(flags)

    def remove_flags(self, refs: Sequence[EmailRef], *, flags: Set[str]) -> None:
        self._maybe_fail()
        if not refs:
            return
        mailbox = self._assert_same_mailbox(refs, "remove_flags")
        box = self._mailboxes.get(mailbox, {})
        for r in refs:
            stored = box.get(r.uid)
            if stored:
                stored.flags -= set(flags)

    # --- mailbox maintenance ---------------------------------------------

    def expunge(self, mailbox: str = "INBOX") -> None:
        """
        Remove messages flagged as \\Deleted from a mailbox.
        """
        self._maybe_fail()
        box = self._mailboxes.get(mailbox, {})
        to_delete = [uid for uid, s in box.items() if r"\Deleted" in s.flags]
        for uid in to_delete:
            del box[uid]

    def list_mailboxes(self) -> List[str]:
        self._maybe_fail()
        return sorted(self._mailboxes.keys())

    def mailbox_status(self, mailbox: str = "INBOX") -> Dict[str, int]:
        self._maybe_fail()
        box = self._mailboxes.get(mailbox, {})
        messages = len(box)
        unseen = sum(1 for s in box.values() if r"\Seen" not in s.flags)
        # Real IMAPClient returns more keys; tests only rely on these.
        return {"messages": messages, "unseen": unseen}

    # --- copy / move / mailbox ops ---------------------------------------

    def move(
        self,
        refs: Sequence[EmailRef],
        *,
        src_mailbox: str,
        dst_mailbox: str,
    ) -> None:
        self._maybe_fail()
        if not refs:
            return
        for r in refs:
            if r.mailbox != src_mailbox:
                raise IMAPError("All EmailRef.mailbox must match src_mailbox for move()")

        src = self._mailboxes.get(src_mailbox, {})
        dst = self._ensure_mailbox(dst_mailbox)

        # move: remove from src, create new UID+ref in dst, update message ref
        for r in refs:
            stored = src.pop(r.uid, None)
            if not stored:
                continue

            new_uid = self._alloc_uid()
            new_ref = EmailRef(uid=new_uid, mailbox=dst_mailbox)
            new_msg = self._clone_message_with_ref(stored.msg, new_ref)
            dst[new_uid] = _StoredMessage(new_msg, set(stored.flags))

    def copy(
        self,
        refs: Sequence[EmailRef],
        *,
        src_mailbox: str,
        dst_mailbox: str,
    ) -> None:
        self._maybe_fail()
        if not refs:
            return
        for r in refs:
            if r.mailbox != src_mailbox:
                raise IMAPError("All EmailRef.mailbox must match src_mailbox for copy()")

        src = self._mailboxes.get(src_mailbox, {})
        dst = self._ensure_mailbox(dst_mailbox)

        for r in refs:
            stored = src.get(r.uid)
            if not stored:
                continue

            new_uid = self._alloc_uid()
            new_ref = EmailRef(uid=new_uid, mailbox=dst_mailbox)
            new_msg = self._clone_message_with_ref(stored.msg, new_ref)
            dst[new_uid] = _StoredMessage(new_msg, set(stored.flags))

    def create_mailbox(self, name: str) -> None:
        self._maybe_fail()
        self._ensure_mailbox(name)

    def delete_mailbox(self, name: str) -> None:
        self._maybe_fail()
        self._mailboxes.pop(name, None)

    def ping(self) -> None:
        """
        Minimal health check; used by EmailManager.health_check.
        """
        self._maybe_fail()

    def close(self) -> None:
        """
        Real IMAPClient.close() drops network connection; here it's a no-op.
        """
        self._maybe_fail()

    def __enter__(self) -> FakeIMAPClient:
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()
