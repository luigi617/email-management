from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class Attachment:
    id: int
    filename: str
    content_type: str
    data: bytes
    data_size: int

    def __repr__(self) -> str:
        return (
            f"Attachment("
            f"filename={self.filename!r}, "
            f"content_type={self.content_type!r}, "
            f"data_size={len(self.data)} bytes)"
        )
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "filename": self.filename,
            "content_type": self.content_type,
            "data_size": self.data_size,
        }