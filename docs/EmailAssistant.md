# EmailAssistant

`EmailAssistant` is the main interface for **LLM-powered email intelligence** in OpenMail. It provides high-level operations such as summarization, reply generation, prioritization, follow-up suggestions, natural-language search construction, phishing detection, sender trust evaluation, and task extraction.

`EmailAssistant` works *alongside* `EmailManager`:
- **EmailManager** handles IMAP/SMTP (fetching, sending, folders, flags)
- **EmailAssistant** handles reasoning, language understanding, and content generation

It never sends, fetches, or mutates mailboxes directly.

---

## 🔑 Requirements for LLM Usage

Using `EmailAssistant` requires:

1. **A valid API key in your environment**
2. **A supported `(provider, model_name)` pair**

Example environment variables:

```
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."
export ANTHROPIC_API_KEY="..."
export XAI_API_KEY="..."
export GROQ_API_KEY="..."
```

If the required key is missing for the selected provider, assistant calls will fail at runtime.

---

## 🤝 Supported Providers & Models

Each assistant method requires you to explicitly specify a provider and model.

### **OpenAI** → `provider="openai"`
```
gpt-5-mini
gpt-5-nano
gpt-5.2
gpt-4o
gpt-4o-mini
```

### **XAI** → `provider="xai"`
```
grok-4-1-fast-reasoning
grok-4-1-fast-non-reasoning
grok-4
grok-4-fast-reasoning
grok-4-fast-non-reasoning
grok-3-mini
grok-3
```

### **Groq** → `provider="groq"`
```
openai/gpt-oss-20b
openai/gpt-oss-120b
moonshotai/kimi-k2-instruct-0905
meta-llama/llama-4-scout-17b-16e-instruct
meta-llama/llama-4-maverick-17b-128e-instruct
qwen/qwen3-32b
llama-3.1-8b-instant
```

### **Gemini** → `provider="gemini"`
```
gemini-3-flash-preview
gemini-2.5-flash
gemini-2.5-flash-lite
```

### **Claude** → `provider="claude"`
```
claude-opus-4.5
claude-opus-4.1
claude-opus-4
claude-sonnet-4.5
claude-sonnet-4
claude-haiku-4.5
claude-haiku-3.5
claude-haiku-3
```

---

## What EmailAssistant Does

`EmailAssistant` exposes structured, task-oriented methods for:

- **Summarizing emails**
  - single messages
  - multiple messages
  - full threads
- **Generating replies**
  - concise replies
  - contextual replies
  - multiple reply suggestions
- **Generating follow-ups** for stalled conversations
- **Extracting tasks** from email content
- **Prioritizing emails** with numeric scores
- **Classifying emails** into custom categories
- **Evaluating sender trust**
- **Detecting phishing**
- **Summarizing attachments**
- **Composing new emails from instructions**
- **Rewriting drafts**
- **Translating emails**
- **Building IMAP queries from natural language**

All methods return both a **result** and **metadata** describing the LLM call.

---

## Basic Construction

Create an assistant without persona customization:

```
from openmail import EmailAssistant

assistant = EmailAssistant()
```

This produces neutral, default-style outputs.

---

## Persona & Tone with EmailAssistantProfile

`EmailAssistantProfile` allows you to personalize how the assistant writes and reasons.  
Persona data is automatically embedded into prompts when relevant.

```
from openmail import EmailAssistant, EmailAssistantProfile

profile = EmailAssistantProfile(
    name="Alex",
    role="Support Engineer",
    company="ExampleCorp",
    tone="friendly",
    locale="en-US",
    extra_context="B2B SaaS customer support",
)

assistant = EmailAssistant(profile=profile)
```

Supported profile fields include:
- `name`
- `role`
- `company`
- `tone` (e.g. formal, friendly, concise)
- `locale`
- `extra_context`

---

## Summarization

### Single email

```
summary, meta = assistant.summarize_email(
    message=email,
    provider="openai",
    model_name="gpt-4o",
)
```

### Multiple emails

```
summary, meta = assistant.summarize_multi_emails(
    messages=emails,
    provider="openai",
    model_name="gpt-4o",
)
```

If no messages are provided, a safe fallback response is returned.

### Thread summarization

```
summary, meta = assistant.summarize_thread(
    thread_messages=thread,
    provider="openai",
    model_name="gpt-4o",
)
```

Thread summaries highlight:
- key decisions
- open questions
- next steps

---

## Reply Generation

### Contextual reply

```
reply_text, meta = assistant.generate_reply(
    reply_context="Confirm resolution and next steps.",
    message=email,
    provider="openai",
    model_name="gpt-4o",
)
```

If a profile is present, persona and tone are automatically applied.

### Reply suggestions

```
suggestions, meta = assistant.generate_reply_suggestions(
    message=email,
    provider="openai",
    model_name="gpt-4o",
)
```

Returns multiple candidate replies for UI-driven workflows.

### Follow-up generation

```
followup, meta = assistant.generate_follow_up(
    message=email,
    provider="openai",
    model_name="gpt-4o",
)
```

---

## Composing & Rewriting Emails

### Compose a new email from instructions

```
subject, body, meta = assistant.compose_email(
    instructions="Write a polite reminder about an overdue invoice.",
    provider="openai",
    model_name="gpt-4o",
)
```

### Rewrite an existing draft

```
rewritten, meta = assistant.rewrite_email(
    draft_text=draft,
    style="more concise and professional",
    provider="openai",
    model_name="gpt-4o",
)
```

---

## Translation

Translate an email or arbitrary text:

```
translated, meta = assistant.translate_email(
    text=email_text,
    target_language="fr-FR",
    provider="openai",
    model_name="gpt-4o",
)
```

Source language is auto-detected unless explicitly provided.

---

## Task Extraction

Extract structured action items from emails:

```
tasks, meta = assistant.extract_tasks(
    messages=emails,
    provider="openai",
    model_name="gpt-4o",
)
```

Returned tasks use a generic `Task` model that can be mapped into:
- task managers
- CRMs
- ticketing systems
- workflow engines

---

## Prioritization & Classification

### Priority scoring

```
scores, meta = assistant.prioritize_emails(
    messages=emails,
    provider="openai",
    model_name="gpt-4o",
)
```

### Classification

```
labels, meta = assistant.classify_emails(
    messages=emails,
    classes=["invoice", "notification", "personal"],
    provider="openai",
    model_name="gpt-4o",
)
```

---

## Threat & Trust Evaluation

### Phishing detection

```
is_phish, meta = assistant.detect_phishing(
    message=email,
    provider="openai",
    model_name="gpt-4o",
)
```

### Sender trust evaluation

```
score, meta = assistant.evaluate_sender_trust(
    message=email,
    provider="openai",
    model_name="gpt-4o",
)
```

Trust scores are heuristic and intended for ranking or warning signals, not absolute guarantees.

---

## Attachment Intelligence

### Summarize attachments

```
summaries, meta = assistant.summarize_attachments(
    message=email,
    provider="openai",
    model_name="gpt-4o",
)
```

Returns a mapping of attachment identifiers to summaries.

### Detect missing attachments

```
missing = assistant.detect_missing_attachment(raw_email_message)
```

This is a heuristic check that looks for phrases like “see attached” when no attachment exists.

---

## Natural-Language IMAP Search

Convert English queries into `EmailQuery` objects:

```
query, info = assistant.search_emails(
    "find unread security alerts from Google last week",
    provider="openai",
    model_name="gpt-4o",
)
page, msgs = query.fetch()
```

This allows user-facing search without exposing IMAP syntax.

---

`EmailAssistant` is designed to be **stateless, composable, and explicit**: every call declares its provider, model, and intent, making it safe for production workflows and easy to audit.