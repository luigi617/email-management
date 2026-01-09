from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Sequence, TYPE_CHECKING

from email_management.types import EmailRef

if TYPE_CHECKING:
    from email_management.models.attachment import Attachment

@dataclass(frozen=True)
class EmailMessage:
    ref: EmailRef
    subject: str
    from_email: str
    to: Sequence[str]
    cc: Sequence[str] = field(default_factory=list)
    bcc: Sequence[str] = field(default_factory=list)
    text: Optional[str] = None
    html: Optional[str] = None
    attachments: List["Attachment"] = field(default_factory=list)

    # IMAP metadata
    date: Optional[datetime] = None
    message_id: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)

    def __repr__(self) -> str:
        return (
            f"EmailMessage("
            f"subject={self.subject!r}, "
            f"from={self.from_email!r}, "
            f"to={list(self.to)!r}, "
            f"attachments={len(self.attachments)})"
        )