# Email-Manager

Lightweight Python toolkit for working with email via IMAP (read/search) and SMTP (send), with optional AI assistant features (summaries, reply templates, and more).  
Provides a simple high-level `EmailManager` plus a flexible `EasyIMAPQuery` builder for composing IMAP queries without worrying about low-level protocol details.

---

## Installation

Install from PyPI:

```
pip install email-manager
```

---

## Features

- Base functionality via SMTP and IMAP (sends, search, fetch)
- Compose IMAP queries using a compact builder pattern  
- Designed to be minimal, testable, and framework-agnostic  
- Supports AI assistants (e.g., automated summaries, reply templates, and more upcoming)

---

## Core Concepts

### `EmailManager`

`EmailManager` coordinates the IMAP and SMTP layers.  
You create it once with the necessary clients/auth, then use it to send emails or navigate mailboxes.


---

### `EasyIMAPQuery`

`EasyIMAPQuery` is a query builder used to construct IMAP search expressions before executing them.  
It abstracts away raw IMAP tokens, letting you express filters more naturally, and only hits the server when you call a search/fetch method on it (from the manager).


---

## Example Usage

Initialize an `EmailManager` with your own IMAP/SMTP clients:

```
from email_management.email_manager import EmailManager
from email_management.smtp import SMTPClient
from email_management.imap import IMAPClient

smtp = SMTPClient(host="smtp.example.com", port=587, auth=...)
imap = IMAPClient(host="imap.example.com", port=993, auth=...)

mgr = EmailManager(imap=imap, smtp=smtp)
```

Now you can use `mgr` wherever you need to send or browse email.

---

## License

MIT
