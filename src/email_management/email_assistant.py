from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Set, Tuple


from email_management.assistants import (
    llm_concise_reply_for_email,
    llm_summarize_single_email,
    llm_summarize_many_emails,
    llm_easy_imap_query_from_nl,
)
from email_management.email_manager import EmailManager
from email_management.email_query import EasyIMAPQuery
from email_management.models import EmailMessage

class EmailAssistant:

    def generate_reply(
        self,
        message: EmailMessage,
        *,
        model_path: str,
    ) -> Tuple[str, Dict[str, Any]]:
        return llm_concise_reply_for_email(
            message,
            model_path=model_path,
        )
    
    def summarize_email(
        self,
        message: EmailMessage,
        *,
        model_path: str,
    ) -> Tuple[str, Dict[str, Any]]:
        return llm_summarize_single_email(
            message,
            model_path=model_path,
        )
    
    def summarize_multi_emails(
        self,
        messages: Sequence[EmailMessage],
        *,
        model_path: str,
    ) -> Tuple[str, Dict[str, Any]]:
        
        if not messages:
            return "No emails selected.", {}

        return llm_summarize_many_emails(
            messages,
            model_path=model_path,
        )
    
    def build_query_from_nl(
        self,
        user_request: str,
        *,
        model_path: str,
        manager: EmailManager,
        mailbox: str = "INBOX",
    ) -> Tuple[EasyIMAPQuery, Dict[str, Any]]:
        """
        Turn a natural-language request like:
            "find unread security alerts from Google last week"
        into an EasyIMAPQuery + llm_call_info.
        """
        return llm_easy_imap_query_from_nl(
            user_request,
            model_path=model_path,
            manager=manager,
            mailbox=mailbox,
        )
    
 