import os

import pytest

from email_management.auth import PasswordAuth
from email_management.config import SMTPConfig, IMAPConfig
from email_management.smtp.client import SMTPClient
from email_management.imap.client import IMAPClient
from email_management import EmailManager

from dotenv import load_dotenv
load_dotenv(override=True)

def get_email_manager():
    username = os.environ.get("EMAIL_USERNAME")
    password = os.environ.get("EMAIL_PASSWORD")
    auth = PasswordAuth(
        username=username,
        password=password,
    )

    smtp_cfg = SMTPConfig(
        host="smtp.gmail.com",
        port=587,
        use_starttls=True,
        from_email=username,
        auth=auth,
    )

    imap_cfg = IMAPConfig(
        host="imap.gmail.com",
        port=993,
        auth=auth,
    )

    smtp = SMTPClient.from_config(smtp_cfg)
    imap = IMAPClient.from_config(imap_cfg)
    manager = EmailManager(smtp=smtp, imap=imap)

    return manager