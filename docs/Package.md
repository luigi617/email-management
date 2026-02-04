# OpenMail

OpenMail is a lightweight, extensible Python toolkit for working with email systems using **IMAP** (reading, searching, triage) and **SMTP** (sending and composing), with optional **LLM-powered assistance** for summarization, replies, prioritization, and intelligent search.

The package is designed with a clean separation of concerns:
- **Transport**: IMAP and SMTP clients
- **Coordination**: a single high-level manager
- **Query building**: fluent, lazy IMAP queries
- **Intelligence**: optional LLM-based workflows

OpenMail is suitable for building inbox tools, assistants, dashboards, CRMs, helpdesks, or personal productivity systems.

---

## 📦 Installation

```
pip install openmail
```

---

## 🧱 Package Architecture

OpenMail exposes three main high-level components:

| Component | Purpose |
|---|---|
| **EmailManager** | Coordinates IMAP & SMTP for sending, fetching, replying, forwarding, and mailbox operations |
| **EmailQuery** | Fluent, lazy IMAP query builder |
| **EmailAssistant** | Optional LLM-powered assistant for summarization, replies, search, and analysis |

Each component is documented in detail in its own markdown file.  
This document only provides a **high-level overview and initialization examples**.

---

## 🔌 EmailManager

`EmailManager` is the central orchestration layer.  
It combines an IMAP client and an SMTP client into a single, consistent API.

### Basic Initialization

```
from openmail.smtp import SMTPClient
from openmail.imap import IMAPClient
from openmail.auth import PasswordAuth
from openmail import EmailManager

auth = PasswordAuth(
    username="you@example.com",
    password="app_password",
)

imap = IMAPClient(
    host="imap.example.com",
    port=993,
    auth=auth,
)

smtp = SMTPClient(
    host="smtp.example.com",
    port=587,
    auth=auth,
)

manager = EmailManager(
    imap=imap,
    smtp=smtp,
)
```

`EmailManager` is responsible for:
- Sending and composing messages
- Fetching messages and threads
- Replying, reply-all, forwarding
- Flags, folders, triage, unsubscribe helpers

➡️ See [docs/EmailManager.md](docs/EmailManager.md) for the full API and workflows.

---

## 🔎 EmailQuery

`EmailQuery` is a fluent builder for IMAP searches.  
It is **lazy**: no IMAP call is made until you execute the query.

### Basic Initialization

You normally create it from `EmailManager`:

```
q = manager.imap_query(mailbox="INBOX")
```

### Example Usage

```
q = (
    manager.imap_query()
           .from_any("alerts@example.com")
           .recent_unread(7)
)

page, messages = q.fetch()
```

`EmailQuery` focuses only on **search construction and execution**.

➡️ See [docs/EmailQuery.md](docs/EmailQuery.md) for all available filters and execution options.

---

## 🤖 EmailAssistant

`EmailAssistant` provides optional **LLM-powered intelligence** on top of email data.  
It does not send or fetch emails by itself; it operates on `EmailMessage` objects.

### Basic Initialization

```
from openmail import EmailAssistant

assistant = EmailAssistant()
```

### With Persona Customization

```
from openmail import EmailAssistant, EmailAssistantProfile

profile = EmailAssistantProfile(
    name="Alex",
    role="Support Engineer",
    company="ExampleCorp",
    tone="friendly",
)

assistant = EmailAssistant(profile=profile)
```

`EmailAssistant` supports:
- Email summarization (single, multi, thread)
- Reply and follow-up generation
- Task extraction
- Prioritization and classification
- Natural-language IMAP search construction
- Phishing detection and sender trust evaluation

➡️ See [docs/EmailAssistant.md](docs/EmailAssistant.md) for supported providers, models, and all methods.
