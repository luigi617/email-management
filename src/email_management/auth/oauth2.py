from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Callable

from email_management.auth.base import AuthContext
from email_management.errors import AuthError


@dataclass(frozen=True)
class OAuth2Auth:
    """
    XOAUTH2-based auth. You provide a function that returns a fresh access token.
    - token_provider() -> access_token (string)
    """
    username: str
    token_provider: Callable[[], str]

    def _xoauth2_string(self, access_token: str) -> str:
        # Format: "user=<email>\x01auth=Bearer <token>\x01\x01"
        s = f"user={self.username}\x01auth=Bearer {access_token}\x01\x01"
        return base64.b64encode(s.encode("utf-8")).decode("utf-8")

    def apply_imap(self, conn, ctx: AuthContext) -> None:
        try:
            token = self.token_provider()
            auth_str = self._xoauth2_string(token)

            def auth_cb(_):
                return auth_str

            typ, _ = conn.authenticate("XOAUTH2", auth_cb)
            if typ != "OK":
                raise AuthError("IMAP XOAUTH2 auth failed (non-OK response)")
        except Exception as e:
            raise AuthError(f"IMAP XOAUTH2 auth failed: {e}") from e

    def apply_smtp(self, server, ctx: AuthContext) -> None:
        """
        smtplib doesn't expose a single 'authenticate XOAUTH2' helper,
        but you can issue an AUTH command. Many servers accept this.
        """
        try:
            token = self.token_provider()
            auth_str = self._xoauth2_string(token)
            code, resp = server.docmd("AUTH", "XOAUTH2 " + auth_str)
            if code != 235:
                raise AuthError(f"SMTP XOAUTH2 auth failed: {code} {resp}")
        except Exception as e:
            raise AuthError(f"SMTP XOAUTH2 auth failed: {e}") from e
