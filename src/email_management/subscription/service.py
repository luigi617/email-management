from email.message import EmailMessage
from typing import Dict, List, Optional

from email_management.smtp import SMTPClient

from email_management.models import (
    UnsubscribeCandidate,
    UnsubscribeActionResult,
    UnsubscribeMethod,
)


class SubscriptionService:
    def __init__(self, smtp: SMTPClient):
        self.smtp = smtp

    def unsubscribe(
        self,
        candidates: List[UnsubscribeCandidate],
        *,
        prefer: str = "mailto",
        from_addr: Optional[str] = None,
        dry_run: bool = True,
    ) -> Dict[str, List[UnsubscribeActionResult]]:
        """
        Executes unsubscribe actions.

        Safety:
        - dry_run=True does NOT send emails
        - HTTP methods are NEVER auto-called
        """
        results = {"sent": [], "http": [], "skipped": []}

        for cand in candidates:
            method = _choose_method(cand.methods, prefer)
            if not method:
                results["skipped"].append(
                    UnsubscribeActionResult(
                        ref=cand.ref,
                        method=None,
                        sent=False,
                        note="No supported unsubscribe method",
                    )
                )
                continue

            if method.kind == "mailto":
                if dry_run:
                    results["sent"].append(
                        UnsubscribeActionResult(
                            ref=cand.ref,
                            method=method,
                            sent=False,
                            note="dry-run",
                        )
                    )
                else:
                    msg = EmailMessage()
                    msg["To"] = method.value
                    msg["Subject"] = "unsubscribe"
                    if from_addr:
                        msg["From"] = from_addr
                    msg.set_content("unsubscribe")

                    res = self.smtp.send(msg)
                    results["sent"].append(
                        UnsubscribeActionResult(
                            ref=cand.ref,
                            method=method,
                            sent=True,
                            send_result=res,
                        )
                    )

            elif method.kind == "http":
                results["http"].append(
                    UnsubscribeActionResult(
                        ref=cand.ref,
                        method=method,
                        sent=False,
                        note="manual http unsubscribe",
                    )
                )

        return results


def _choose_method(methods: List[UnsubscribeMethod], prefer: str) -> Optional[UnsubscribeMethod]:
    prefer = prefer.lower()
    if prefer == "mailto":
        for m in methods:
            if m.kind == "mailto":
                return m
        for m in methods:
            if m.kind == "http":
                return m
    elif prefer == "http":
        for m in methods:
            if m.kind == "http":
                return m
        for m in methods:
            if m.kind == "mailto":
                return m
    return methods[0] if methods else None
