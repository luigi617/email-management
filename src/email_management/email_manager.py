from __future__ import annotations

from dataclasses import dataclass
from email.message import EmailMessage as PyEmailMessage
from typing import Any, Dict, List, Optional, Sequence, Set

from email_management.email_query import EasyIMAPQuery
from email_management.models import UnsubscribeCandidate
from email_management.subscription import SubscriptionService, SubscriptionDetector
from email_management.imap import IMAPClient
from email_management.smtp import SMTPClient
from email_management.types import EmailRef, SendResult


# RFC 3501 IMAP system flags
SEEN = r"\Seen"
ANSWERED = r"\Answered"
FLAGGED = r"\Flagged"
DELETED = r"\Deleted"
DRAFT = r"\Draft"




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