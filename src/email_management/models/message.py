from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Sequence

from email_management.models import Attachment

@dataclass(frozen=True)
class EmailMessage:
    subject: str
    from_email: str
    to: Sequence[str]
    cc: Sequence[str] = field(default_factory=list)
    bcc: Sequence[str] = field(default_factory=list)
    text: Optional[str] = None
    html: Optional[str] = None
    attachments: List[Attachment] = field(default_factory=list)

    # IMAP metadata
    date: Optional[datetime] = None
    message_id: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)
