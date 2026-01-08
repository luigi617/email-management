# src.email_management/__init__.py
from email_management.config import SMTPConfig, IMAPConfig
from email_management.email_manager import EmailManager

__all__ = ["EmailManager", "SMTPConfig", "IMAPConfig"]
