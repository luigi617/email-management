# EmailAssistant

`EmailAssistant` is the main interface for LLM-powered email operations such as summarization, reply generation, prioritization, follow-up suggestions, natural-language search construction, phishing evaluation, and task extraction.

This component works alongside `EmailManager` (for IMAP/SMTP) and optionally uses `EmailAssistantProfile` to adapt generated content to the user’s persona and tone.

---

## What EmailAssistant Does

`EmailAssistant` provides structured methods for:

- **Summarizing emails** (single, multi, threaded)
- **Generating replies** (concise or contextual)
- **Suggesting replies** (multiple choices)
- **Generating follow-ups** (for stalled threads)
- **Extracting tasks** (turn messages into actionable items)
- **Prioritizing emails** (numeric scores)
- **Classifying emails** (category assignment)
- **Evaluating sender trust**
- **Detecting phishing**
- **Summarizing attachments**
- **Building IMAP queries from natural language**

It does **not** send, fetch, or modify mailboxes — those responsibilities belong to `EmailManager`.

---

## Basic Construction

```
from email_assistant import EmailAssistant

assistant = EmailAssistant()
```

This creates an assistant without persona adjustments.

---

## Persona & Tone with EmailAssistantProfile

Although optional, `EmailAssistantProfile` allows the assistant to generate content that **better matches the user’s writing style**, role, and organizational context.  
This results in replies and summaries that are **more suitable and consistent** for real-world workflows (e.g., support, sales, academic, executive).

```
from email_assistant import EmailAssistant, EmailAssistantProfile

profile = EmailAssistantProfile(
    name="Alex",
    role="Support Engineer",
    company="ExampleCorp",
    tone="friendly",
)

assistant = EmailAssistant(profile=profile)
```

When generating outputs, persona + tone info is embedded automatically.

---

## Summarizing Email

Summarize a single email:

```
summary, meta = assistant.summarize_email(
    message=email,
    provider="openai",
    model_name="gpt-4.1",
)
```

Summarize multiple:

```
summary, meta = assistant.summarize_multi_emails(
    messages=emails,
    provider="openai",
    model_name="gpt-4.1",
)
```

Summarize a thread:

```
summary, meta = assistant.summarize_thread(
    thread_messages=thread,
    provider="openai",
    model_name="gpt-4.1",
)
```

---

## Reply Generation

Contextual replies:

```
reply_text, meta = assistant.generate_reply(
    reply_context="Confirm resolution and next steps.",
    message=email,
    provider="openai",
    model_name="gpt-4.1",
)
```

Reply suggestions (multiple choices):

```
suggestions, meta = assistant.generate_reply_suggestions(
    message=email,
    provider="openai",
    model_name="gpt-4.1",
)
```

Follow-up messages:

```
followup, meta = assistant.generate_follow_up(
    message=email,
    provider="openai",
    model_name="gpt-4.1",
)
```

If a profile is attached, these outputs will reflect persona and tone.

---

## Task Extraction

Convert emails into structured tasks:

```
tasks, meta = assistant.extract_tasks(
    messages=emails,
    provider="openai",
    model_name="gpt-4.1",
)
```

Useful for CRM, PM tools, ticketing, triage dashboards, etc.

---

## Prioritization & Classification

Assign numeric priority:

```
scores, meta = assistant.prioritize_emails(
    messages=emails,
    provider="openai",
    model_name="gpt-4.1",
)
```

Classify into categories:

```
labels, meta = assistant.classify_emails(
    messages=emails,
    classes=["invoice", "notification", "personal"],
    provider="openai",
    model_name="gpt-4.1",
)
```

---

## Threat & Trust Evaluation

Detect phishing:

```
is_phish, meta = assistant.detect_phishing(
    message=email,
    provider="openai",
    model_name="gpt-4.1",
)
```

Evaluate sender trust:

```
score, meta = assistant.evaluate_sender_trust(
    message=email,
    provider="openai",
    model_name="gpt-4.1",
)
```

---

## Natural-Language Search Builder

Convert English requests into IMAP queries:

```
query, info = assistant.search_emails(
    "find unread security alerts from Google last week",
    provider="openai",
    model_name="gpt-4.1",
    manager=mgr,  # EmailManager instance
)
msgs = query.fetch()
```

This allows high-level filtering without knowing IMAP syntax.
