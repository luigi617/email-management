from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class Attachment:
    filename: str
    content_type: str
    data: bytes

    def __repr__(self) -> str:
        return (
            f"Attachment("
            f"filename={self.filename!r}, "
            f"content_type={self.content_type!r}, "
            f"data_size={len(self.data)} bytes)"
        )