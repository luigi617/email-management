# EmailManager

`EmailManager` coordinates IMAP and SMTP so you can **send, fetch, reply, forward, move, and triage emails** through a single high-level API.

It wraps:

- `SMTPClient` (sending mail)
- `IMAPClient` (reading/searching mail)
- `EmailQuery` (fluent IMAP query builder)

---

## Creating an EmailManager

```
from openmail.smtp import SMTPClient
from openmail.imap import IMAPClient
from openmail.auth import PasswordAuth
from openmail import EmailManager

auth = PasswordAuth(username="you@example.com", password="secret")

smtp = SMTPClient(host="smtp.example.com", port=587, auth=auth)
imap = IMAPClient(host="imap.example.com", port=993, auth=auth)

mgr = EmailManager(smtp=smtp, imap=imap)
```

You can also use OAuth-based auth if your provider requires it.

```
def token_provider():
    # Must return a fresh OAuth2 access token string
    return get_access_token_somehow()

auth = OAuth2Auth(username="you@example.com", token_provider=token_provider)
```

---

## Composing & Sending Email

`EmailManager` composes messages and sends them via SMTP.

### Compose only

Use `compose()` when you want to build a message you can inspect, store, or modify before sending.

```
msg = mgr.compose(
    subject="Welcome!",
    to=["user@example.com"],
    from_addr="me@example.com",
    text="Thanks for signing up.",
)
```

#### Text + HTML bodies

If you provide both `text` and `html`, the manager builds a `multipart/alternative` email.

```
msg = mgr.compose(
    subject="Product update",
    to=["user@example.com"],
    from_addr="me@example.com",
    text="Plain text fallback",
    html="<p><b>HTML</b> version</p>",
)
```

#### Attachments

Attachments use OpenMail’s `Attachment` model and are added to the composed message.

```
from openmail.models import Attachment

pdf = Attachment(
    filename="report.pdf",
    content_type="application/pdf",
    data=b"%PDF-...",
)

msg = mgr.compose(
    subject="Monthly report",
    to=["boss@example.com"],
    from_addr="me@example.com",
    text="Attached is the PDF.",
    attachments=[pdf],
)
```

### Compose and send

`compose_and_send()` builds and sends in one step.

```
result = mgr.compose_and_send(
    subject="Daily report",
    to=["boss@example.com"],
    from_addr="me@example.com",
    text="Here is the report...",
)
```

### Sending an existing message

If you already have a `EmailMessage` instance (stdlib), you can send it directly:

```
from email.message import EmailMessage

msg = EmailMessage()
msg["From"] = "me@example.com"
msg["To"] = "you@example.com"
msg["Subject"] = "Hello"
msg.set_content("Hi there!")

mgr.send(msg)
```

> Note: `send()` extracts envelope recipients from `To`, `Cc`, and `Bcc`, and removes the `Bcc` header before sending.

---

## Drafts

Save a draft into an IMAP mailbox (default `"Drafts"`). This returns an `EmailRef` you can later fetch or manage through IMAP.

```
ref = mgr.save_draft(
    subject="Draft email",
    to=["user@example.com"],
    from_addr="me@example.com",
    text="I'll finish this later.",
)
```

---

## Replies & Forwarding

These helpers manage common email conventions:
- subject prefixes (`Re:` / `Fwd:`)
- threading headers (`In-Reply-To`, `References`)
- optional quoting of the original message

### Reply

Reply to the sender (or `Reply-To` if present).

```
mgr.reply(
    original=email_msg,         # openmail.models.EmailMessage
    text="Thanks for the update.",
    from_addr="me@example.com", # optional
    quote_original=True,        # include quoted original body
)
```

Notes:
- If `to` is not provided, recipients are derived from `Reply-To` or `From`.
- Threading headers are set automatically when `message_id` is available.
- Quoting works for both text and HTML (when you provide `html`).

### Reply all

Reply to everyone. If you do not provide `to/cc/bcc`, recipients are derived from the original message (`Reply-To`/`From` + original `To`/`Cc`), with basic de-duplication and optional removal of your own address.

```
mgr.reply_all(
    original=email_msg,
    text="Looping everyone in.",
    from_addr="me@example.com",
    quote_original=True,
)
```

### Forward

Forward an existing email.

```
mgr.forward(
    original=email_msg,
    to=["other@example.com"],
    text="FYI.",
    from_addr="me@example.com",
    include_original=True,        # include quoted original in the forward body
    include_attachments=True,     # include original attachments by default
)
```

Notes:
- If `include_original=True`, the original message is quoted into the forwarded body.
- If `include_attachments=True`, original attachments are appended to any explicit `attachments=...`.
- If you provide `html`, that HTML is used; otherwise HTML is synthesized from the text + optional quoted original.

---

## Fetching Email

The fetch APIs return paging metadata along with results. Paging uses UIDs and supports both “older” and “newer” directions.

### Fetch a page of overview rows

`fetch_overview()` returns:
- a `PagedSearchResult` (paging info)
- a list of `EmailOverview` rows (lightweight list-view records)

```
page, overviews = mgr.fetch_overview(
    mailbox="INBOX",
    n=50,
    refresh=True,          # build/refresh the cached search
)
```

To page older results:

```
page2, overviews2 = mgr.fetch_overview(
    mailbox="INBOX",
    n=50,
    before_uid=page.next_before_uid,
)
```

To page newer results:

```
page_newer, newer = mgr.fetch_overview(
    mailbox="INBOX",
    n=50,
    after_uid=page.prev_after_uid,
)
```

### Fetch a page of full messages

`fetch_latest()` returns:
- a `PagedSearchResult`
- a list of full `EmailMessage` objects

```
page, msgs = mgr.fetch_latest(
    mailbox="INBOX",
    n=50,
    unseen_only=True,
    include_attachment_meta=False,
    refresh=True,
)
```

> Tip: set `include_attachment_meta=True` when you need attachment *metadata* on fetched messages.

### Fetch a single message by ref

```
msg = mgr.fetch_message_by_ref(ref, include_attachment_meta=True)
```

### Fetch multiple messages by refs

```
msgs = mgr.fetch_messages_by_multi_refs(refs, include_attachment_meta=False)
```

### Fetch a single attachment by ref + part id

If you already have attachment metadata (including the attachment part identifier), you can fetch the bytes:

```
data = mgr.fetch_attachment_by_ref_and_meta(
    ref=ref,
    attachment_part="2.1",  # example part id from IMAP metadata
)
```

---

## Thread Fetching

Fetch messages belonging to the same thread as a root message (based on `Message-ID` plus `References` / `In-Reply-To`).

```
thread = mgr.fetch_thread(
    root=msgs[0],
    mailbox="INBOX",
    include_attachment_meta=False,
)
```

If the root has no `message_id`, it returns `[root]`.

---

## EmailQuery Integration

Use `imap_query()` to build a fluent filter via `EmailQuery`.

```
q = (
    mgr.imap_query("INBOX")
       .recent_unread(7)
       .from_any("noreply@github.com", "support@example.com")
       .limit(100)
)

page, msgs = q.fetch(include_attachment_meta=False)
```

See `docs/EmailQuery.md` for all query helpers.

---

## Flags & Triage

Flags are manipulated at IMAP level using standard markers such as:
- `\\Seen` (read)
- `\\Flagged` (starred)
- `\\Answered`
- `\\Deleted`
- `\\Draft`

Most flag operations take a sequence of `EmailRef`.

### Mark as seen / unseen

```
mgr.mark_seen(refs)
mgr.mark_unseen(refs)
```

### Flag / unflag

```
mgr.flag(refs)
mgr.unflag(refs)
```

### Answered

```
mgr.mark_answered(refs)
mgr.clear_answered(refs)
```

### Bulk mark all unseen messages as seen

`mark_all_seen()` searches in pages and flags results as seen in chunks.

```
count = mgr.mark_all_seen(mailbox="INBOX", chunk_size=500)
```

---

## Deleting & Expunging

Mark messages as deleted:

```
mgr.delete(refs)
```

Undo delete:

```
mgr.undelete(refs)
```

Permanently remove `\\Deleted` messages in a mailbox:

```
mgr.expunge(mailbox="INBOX")
```

---

## Moving & Copying Messages

Move between folders:

```
mgr.move(
    refs,
    src_mailbox="INBOX",
    dst_mailbox="Archive",
)
```

Copy instead of move:

```
mgr.copy(
    refs,
    src_mailbox="INBOX",
    dst_mailbox="Receipts",
)
```

---

## Mailbox Management

List mailboxes:

```
names = mgr.list_mailboxes()
```

Mailbox status (e.g. message count, unseen count):

```
status = mgr.mailbox_status("INBOX")
# {"messages": X, "unseen": Y}
```

Create or delete a mailbox:

```
mgr.create_mailbox("Newsletters")
mgr.delete_mailbox("OldStuff")
```

---

## Unsubscribe Utilities

`EmailManager` integrates with a subscription helper that looks at `List-Unsubscribe` headers.

### Finding unsubscribe candidates

```
candidates = mgr.list_unsubscribe_candidates(
    mailbox="INBOX",
    limit=200,
    since=None,       # optional provider-specific since filter
    unseen_only=False,
)
```

### Performing unsubscribe actions

```
results = mgr.unsubscribe_selected(
    candidates,
    prefer="mailto",          # or "http"
    from_addr="me@example.com",
)
```

---

## Health Check & Lifecycle

### Health check

Ping both IMAP and SMTP.

```
status = mgr.health_check()
# {"imap": True/False, "smtp": True/False}
```

### Context manager usage

`EmailManager` implements `__enter__` / `__exit__` and `close()` for clean resource handling.

```
with EmailManager(smtp=smtp, imap=imap) as mgr:
    page, msgs = mgr.fetch_latest(n=10, refresh=True)

# or manually:
mgr.close()
```

Both IMAP and SMTP clients are closed best-effort.