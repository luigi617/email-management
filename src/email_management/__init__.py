# src.email_management/__init__.py
from .config import SMTPConfig, IMAPConfig
from .email_manager import EmailManager

__all__ = ["EmailManager", "SMTPConfig", "IMAPConfig"]
