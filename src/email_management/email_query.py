from __future__ import annotations

from typing import List, Tuple

from email_management.email_manager import EmailManager
from email_management.models import EmailMessage
from email_management.imap import IMAPQuery
from email_management.types import EmailRef

class EasyIMAPQuery:
    """
    Builder that composes filters and only hits IMAP when you call .search() or .fetch().
    """

    def __init__(self, manager: EmailManager, mailbox: str = "INBOX"):
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