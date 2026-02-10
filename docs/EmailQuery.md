# EmailQuery

`EmailQuery` is a fluent, lazy IMAP query builder that lets you **compose complex mailbox filters in Python** without dealing directly with raw IMAP syntax.  
It integrates tightly with `EmailManager` and only performs IMAP operations when you explicitly execute the query.

---

## What EmailQuery Is (and Is Not)

**EmailQuery is:**
- A *builder* for common and advanced IMAP SEARCH queries
- Lazy and chainable
- Safe to compose incrementally
- Integrated with paging and caching

It returns either:
- `EmailRef` identifiers (via `search()`)
- Fully parsed `EmailMessage` objects (via `fetch()`)

---

## Why It Exists

Raw IMAP queries are difficult and error-prone to construct, especially when combining:

- Nested OR / AND logic
- Date and size filters
- Sender, recipient, subject, and body matching
- Thread and participant heuristics
- Paging across large mailboxes

`EmailQuery` provides a clean, Pythonic abstraction for **most real-world use cases**, while still allowing you to drop down to raw IMAP when needed.

---

## Construction

You normally obtain an `EmailQuery` from an `EmailManager`:

```
q = mgr.imap_query(mailbox="INBOX")
```

If no mailbox is specified, `"INBOX"` is used by default:

```
q = mgr.imap_query()
```

Internally, each `EmailQuery` wraps:
- a mailbox name
- an underlying `IMAPQuery`
- a page size limit

---

## Lazy Execution Model

`EmailQuery` is **lazy by design**.

```
q = mgr.imap_query().from_any("alerts@example.com").recent_unread(7)

# No IMAP call yet
```

IMAP is contacted only when you execute:

```
page = q.search()          # IMAP SEARCH
page, msgs = q.fetch()    # IMAP SEARCH + FETCH
```

This allows you to:
- build queries incrementally
- reuse query objects
- inspect or modify filters before execution

---

## Common Filters

### Sender matching (OR)

```
q = mgr.imap_query().from_any(
    "billing@example.com",
    "support@example.com",
)
```

### Recipient matching

```
q = mgr.imap_query().to_any("me@example.com", "team@example.com")
```

### Subject matching

```
q = mgr.imap_query().subject_any("invoice", "receipt")
```

### Text body matching

```
q = mgr.imap_query().text_any("urgent", "action required")
```

---

## Date & State Filters

### Recent unread messages

```
q = mgr.imap_query().recent_unread(days=3)
```

Equivalent to:
- `UNSEEN`
- `SINCE <3 days ago (UTC)>`

### Messages from last N days

```
q = mgr.imap_query().last_days(14)
```

---

## Inbox Triage Helper

A common real-world inbox filter is provided out of the box:

```
q = mgr.imap_query().inbox_triage(days=14)
```

This expands to:
- not deleted
- not drafts
- within a recent time window
- and *(unseen OR flagged)*

Useful for inbox dashboards and triage workflows.

---

## Thread & Conversation Matching

### Approximate thread matching

```
q = mgr.imap_query().thread_like(
    subject="Project X",
    participants=[
        "alice@example.com",
        "bob@example.com",
    ],
)
```

### Exact thread root matching

```
q = mgr.imap_query().for_thread_root(root_message)
```

This matches messages via `References` and `In-Reply-To` headers.

---

## Domain & Category Helpers

```
q = mgr.imap_query().from_domain("github.com")
q = mgr.imap_query().invoices_or_receipts()
q = mgr.imap_query().security_alerts()
q = mgr.imap_query().newsletters()
```

---

## Attachment Hinting

IMAP does not reliably support “has attachment” searches.

```
q = mgr.imap_query().with_attachments_hint()
```

This uses common header heuristics such as `Content-Disposition` and `Content-Type`.

---

## Paging & Limits

Each `EmailQuery` has a page size limit (default: 50):

```
q = mgr.imap_query().limit(25)
```

Paging works in both directions using UIDs:

```
page1 = q.search()
page2 = q.search(before_uid=page1.next_before_uid)
page_newer = q.search(after_uid=page1.prev_after_uid)
```

---

## search() vs fetch()

### search()

```
page = q.search()
refs = page.refs
```

- Executes IMAP SEARCH only
- Returns lightweight identifiers
- Fast and suitable for bulk operations

### fetch()

```
page, msgs = q.fetch(include_attachment_meta=False)
```

- Executes SEARCH + FETCH
- Returns full `EmailMessage` objects

---

## Fetching Overviews

For list views and previews:

```
page, overviews = q.fetch_overview()
```

Returns lightweight `EmailOverview` objects.

---

## ⚠️ Advanced Usage: Dropping Down to IMAPQuery

`EmailQuery` covers most use cases, but **IMAP itself is more expressive**.

If `EmailQuery` is not sufficient, you can directly construct advanced queries using the lower-level `IMAPQuery` class:

```
from openmail.imap import IMAPQuery
```

### Using IMAPQuery directly

```
raw_q = (
    IMAPQuery()
        .from_("alerts@example.com")
        .subject("security")
        .unseen()
        .since("2024-01-01")
)
```

You can then inject this into `EmailQuery`:

```
q = mgr.imap_query()
q.query = raw_q

page, msgs = q.fetch()
```

### Mixing EmailQuery helpers with IMAPQuery

Because `EmailQuery.query` is **live**, you can mix both styles:

```
q = mgr.imap_query()
q.recent_unread(7)

# Drop down to IMAPQuery for advanced logic
q.query.or_(
    IMAPQuery().from_("a@example.com"),
    IMAPQuery().from_("b@example.com"),
)

page, msgs = q.fetch()
```

### Raw token injection (expert mode)

```
q = mgr.imap_query()
q.query.raw("OR", 'FROM "a@example.com"', 'FROM "b@example.com"')
```

---

## When to Use What

- Use **EmailQuery** for:
  - 90% of application-level queries
  - readability and maintainability
  - safe chaining and paging

- Use **IMAPQuery** when you need:
  - complex boolean logic
  - exact IMAP semantics
  - full control over SEARCH tokens

---

## High-Level Method Reference

| Method | Meaning |
|---|---|
| `.mailbox(name)` | change target mailbox |
| `.limit(n)` | set page size |
| `.from_any(*senders)` | sender OR matching |
| `.to_any(*recipients)` | recipient OR matching |
| `.subject_any(*needles)` | subject OR matching |
| `.text_any(*needles)` | body text OR matching |
| `.recent_unread(days)` | `UNSEEN` + `SINCE` |
| `.last_days(days)` | messages since N days ago |
| `.inbox_triage(days)` | common inbox filter |
| `.from_domain(domain)` | sender domain matching |
| `.thread_like(...)` | approximate thread matching |
| `.for_thread_root(msg)` | exact thread matching |
| `.newsletters()` | list-unsubscribe detection |
| `.invoices_or_receipts()` | finance-related messages |
| `.security_alerts()` | security notifications |
| `.with_attachments_hint()` | attachment heuristics |
| `.search()` | execute SEARCH |
| `.fetch()` | SEARCH + FETCH |
| `.fetch_overview()` | SEARCH + OVERVIEW |

---

`EmailQuery` gives you a safe, expressive default — and a clean escape hatch to raw IMAP when you need absolute control.
