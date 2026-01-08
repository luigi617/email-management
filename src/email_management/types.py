from __future__ import annotations
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class EmailRef:
    uid: int
    mailbox: str = "INBOX"

@dataclass(frozen=True)
class SendResult:
    ok: bool
    message_id: Optional[str] = None
    detail: Optional[str] = None
