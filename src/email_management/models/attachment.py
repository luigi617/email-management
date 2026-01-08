from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class Attachment:
    filename: str
    content_type: str
    data: bytes