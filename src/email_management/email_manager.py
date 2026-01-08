from __future__ import annotations

from dataclasses import dataclass
from email.message import EmailMessage as PyEmailMessage
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from email_management.models import EmailMessage
from email_management.subscription import SubscriptionService, SubscriptionDetector
from src.email_management.imap import IMAPQuery, IMAPClient
from src.email_management.smtp import SMTPClient
from src.email_management.types import EmailRef, SendResult


# RFC 3501 IMAP system flags
SEEN = r"\Seen"
ANSWERED = r"\Answered"
FLAGGED = r"\Flagged"
DELETED = r"\Deleted"
DRAFT = r"\Draft"


@dataclass(frozen=True)
class UnsubscribeMethod:
    """
    Represents a parsed method from List-Unsubscribe header.
    Example entries: mailto:unsubscribe@x.com, https://x.com/unsub?u=...
    """
    kind: str  # "mailto" | "http"
    value: str  # email address for mailto, URL for http


@dataclass(frozen=True)
class UnsubscribeCandidate:
    ref: EmailRef
    from_email: str
    subject: str
    methods: List[UnsubscribeMethod]


class EasyIMAPQuery:
    """
    Builder that composes filters and only hits IMAP when you call .search() or .fetch().
    """

    def __init__(self, manager: "EmailManager", mailbox: str = "INBOX"):
        self._m = manager
        self._mailbox = mailbox
        self._q = IMAPQuery()
        self._limit: int = 50

    def mailbox(self, mailbox: str) -> "EasyIMAPQuery":
        self._mailbox = mailbox
        return self

    def limit(self, n: int) -> "EasyIMAPQuery":
        self._limit = n
        return self

    # ---- flags/status ----
    def unseen(self) -> "EasyIMAPQuery":
        self._q.unseen()
        return self

    def seen(self) -> "EasyIMAPQuery":
        self._q.seen()
        return self

    def answered(self) -> "EasyIMAPQuery":
        self._q.answered()
        return self

    def flagged(self) -> "EasyIMAPQuery":
        self._q.flagged()
        return self

    # ---- header/body filters ----
    def from_(self, s: str) -> "EasyIMAPQuery":
        self._q.from_(s)
        return self

    def to(self, s: str) -> "EasyIMAPQuery":
        self._q.to(s)
        return self

    def cc(self, s: str) -> "EasyIMAPQuery":
        self._q.cc(s)
        return self

    def bcc(self, s: str) -> "EasyIMAPQuery":
        self._q.bcc(s)
        return self

    def subject(self, s: str) -> "EasyIMAPQuery":
        self._q.subject(s)
        return self

    def text(self, s: str) -> "EasyIMAPQuery":
        self._q.text(s)
        return self

    def body(self, s: str) -> "EasyIMAPQuery":
        self._q.body(s)
        return self

    # ---- date filters (YYYY-MM-DD) ----
    def since(self, iso_date: str) -> "EasyIMAPQuery":
        self._q.since(iso_date)
        return self

    def before(self, iso_date: str) -> "EasyIMAPQuery":
        self._q.before(iso_date)
        return self

    def on(self, iso_date: str) -> "EasyIMAPQuery":
        self._q.on(iso_date)
        return self

    # ---- advanced ----
    def raw(self, *tokens: str) -> "EasyIMAPQuery":
        self._q.raw(*tokens)
        return self

    # ---- execute ----
    def search(self) -> List[EmailRef]:
        return self._m.imap.search(mailbox=self._mailbox, query=self._q, limit=self._limit)

    def fetch(self, *, include_attachments: bool = False) -> List[EmailMessage]:
        refs = self.search()
        return self._m.imap.fetch(refs, include_attachments=include_attachments)

    def search_and_fetch(self, *, include_attachments: bool = False) -> Tuple[List[EmailRef], List[EmailMessage]]:
        refs = self.search()
        msgs = self._m.imap.fetch(refs, include_attachments=include_attachments)
        return refs, msgs


@dataclass(frozen=True)
class EmailManager:
    smtp: SMTPClient
    imap: IMAPClient

    def send(self, msg: PyEmailMessage) -> SendResult:
        return self.smtp.send(msg)

    def query(self, mailbox: str = "INBOX") -> EasyIMAPQuery:
        return EasyIMAPQuery(self, mailbox=mailbox)

    def fetch_latest(
        self,
        *,
        mailbox: str = "INBOX",
        n: int = 50,
        unseen_only: bool = False,
        include_attachments: bool = False,
    ):
        q = self.query(mailbox).limit(n)
        if unseen_only:
            q.unseen()
        return q.fetch(include_attachments=include_attachments)

    
    # -----------------
    # Bulk flag operations (generic + convenience)
    # -----------------
    def add_flags(self, refs: Sequence[EmailRef], flags: Set[str]) -> None:
        """Bulk add flags to refs."""
        if not refs:
            return
        self.imap.add_flags(refs, flags=flags)

    def remove_flags(self, refs: Sequence[EmailRef], flags: Set[str]) -> None:
        """Bulk remove flags from refs."""
        if not refs:
            return
        self.imap.remove_flags(refs, flags=flags)

    # Convenience wrappers (still bulk)
    def mark_seen(self, refs: Sequence[EmailRef]) -> None:
        self.add_flags(refs, {SEEN})

    def mark_all_seen(self, mailbox: str = "INBOX", *, chunk_size: int = 500) -> int:
        total = 0
        while True:
            refs = self.query(mailbox).unseen().limit(chunk_size).search()
            if not refs:
                break
            self.add_flags(refs, {SEEN})
            total += len(refs)
        return total

    def mark_unseen(self, refs: Sequence[EmailRef]) -> None:
        self.remove_flags(refs, {SEEN})

    def flag(self, refs: Sequence[EmailRef]) -> None:
        self.add_flags(refs, {FLAGGED})

    def unflag(self, refs: Sequence[EmailRef]) -> None:
        self.remove_flags(refs, {FLAGGED})

    def delete(self, refs: Sequence[EmailRef]) -> None:
        self.add_flags(refs, {DELETED})

    def undelete(self, refs: Sequence[EmailRef]) -> None:
        self.remove_flags(refs, {DELETED})

    def list_unsubscribe_candidates(
        self,
        *,
        mailbox: str = "INBOX",
        limit: int = 200,
        since: Optional[str] = None,
        unseen_only: bool = False,
    ) -> List[UnsubscribeCandidate]:
        """
        Returns emails that expose List-Unsubscribe.
        Requires your parser to preserve headers (List-Unsubscribe).
        """
        detector = SubscriptionDetector(self.imap)
        return detector.find(
            mailbox=mailbox,
            limit=limit,
            since=since,
            unseen_only=unseen_only,
        )

    def unsubscribe_selected(
        self,
        candidates: Sequence[UnsubscribeCandidate],
        *,
        prefer: str = "mailto",
        from_addr: Optional[str] = None,
        dry_run: bool = True,
    ) -> Dict[str, Any]:
        """
        Delegates unsubscribe execution to SubscriptionService.

        Safety:
        - dry_run=True does not send anything
        - http unsubscribe is returned for manual action (no requests)
        """
        service = SubscriptionService(self.smtp)
        return service.unsubscribe(
            list(candidates),
            prefer=prefer,
            from_addr=from_addr,
            dry_run=dry_run,
        )