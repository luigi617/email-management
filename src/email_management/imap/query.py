# src/email_management/imap/query.py
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List


def _imap_date(iso_yyyy_mm_dd: str) -> str:
    dt = datetime.strptime(iso_yyyy_mm_dd, "%Y-%m-%d")
    return dt.strftime("%d-%b-%Y")


def _q(s: str) -> str:
    """
    Quote/escape a string for IMAP SEARCH.
    IMAP uses double quotes for string literals; backslash can escape quotes.
    """
    s = s.replace("\\", "\\\\").replace('"', r"\"")
    return f'"{s}"'


@dataclass
class IMAPQuery:
    parts: List[str] = field(default_factory=list)

    # --- basic fields ---
    def from_(self, s: str) -> "IMAPQuery":
        self.parts += ["FROM", _q(s)]
        return self

    def to(self, s: str) -> "IMAPQuery":
        self.parts += ["TO", _q(s)]
        return self

    def cc(self, s: str) -> "IMAPQuery":
        self.parts += ["CC", _q(s)]
        return self

    def bcc(self, s: str) -> "IMAPQuery":
        self.parts += ["BCC", _q(s)]
        return self

    def subject(self, s: str) -> "IMAPQuery":
        self.parts += ["SUBJECT", _q(s)]
        return self

    def text(self, s: str) -> "IMAPQuery":
        """
        Match in headers OR body text.
        """
        self.parts += ["TEXT", _q(s)]
        return self

    def body(self, s: str) -> "IMAPQuery":
        """
        Match only in body text.
        """
        self.parts += ["BODY", _q(s)]
        return self

    # --- date filters ---
    def since(self, iso_date: str) -> "IMAPQuery":
        self.parts += ["SINCE", _imap_date(iso_date)]
        return self

    def before(self, iso_date: str) -> "IMAPQuery":
        self.parts += ["BEFORE", _imap_date(iso_date)]
        return self

    def on(self, iso_date: str) -> "IMAPQuery":
        self.parts += ["ON", _imap_date(iso_date)]
        return self

    # --- flags/status ---
    def seen(self) -> "IMAPQuery":
        self.parts += ["SEEN"]
        return self

    def unseen(self) -> "IMAPQuery":
        self.parts += ["UNSEEN"]
        return self

    def answered(self) -> "IMAPQuery":
        self.parts += ["ANSWERED"]
        return self

    def flagged(self) -> "IMAPQuery":
        self.parts += ["FLAGGED"]
        return self

    # --- composition helpers ---
    def all(self) -> "IMAPQuery":
        self.parts += ["ALL"]
        return self

    def raw(self, *tokens: str) -> "IMAPQuery":
        """
        Append raw tokens for advanced users, e.g. raw("OR", 'FROM "a"', 'FROM "b"')
        """
        self.parts += list(tokens)
        return self

    def build(self) -> str:
        return " ".join(self.parts) if self.parts else "ALL"
