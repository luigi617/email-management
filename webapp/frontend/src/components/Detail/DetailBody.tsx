import { useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import type { Attachment } from "../../types/email";
import DetailAttachments from "./DetailAttachments";
import styles from "@/styles/DetailBody.module.css";

function htmlToText(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
  return (div.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeEmailHtml(html: string) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "script",
      "style",
      "noscript",
      "iframe",
      "object",
      "embed",
      "base",
      "meta",
      "link",
      "form",
      "input",
      "button",
      "textarea",
      "select",
    ],
    FORBID_ATTR: [
      "onload",
      "onclick",
      "onerror",
      "onmouseover",
      "onfocus",
      "onsubmit",
      "onmouseenter",
      "onmouseleave",
      "onkeydown",
      "onkeyup",
      "onkeypress",
      "oninput",
      "onchange",
    ],
  });
}

const SHADOW_EMAIL_CSS = `
  :host {
    display: block;
    width: 100%;
    min-width: 0;
  }

  .email-root {
    color-scheme: light;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.45;
    color: #111827;
    background: transparent;

    width: 100%;
    max-width: 100%;

    /* Never allow horizontal overflow */
    overflow-x: hidden;

    /* Defaults that help reflow */
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  img { max-width: 100%; height: auto; }


  /* Links can be ultra-long (tracking URLs). Break them more aggressively. */
  .email-root a {
    word-break: break-all !important;
    overflow-wrap: anywhere !important;
  }

  /* Preserve newlines but wrap long lines */
  pre, code, tt {
    white-space: pre-wrap !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }

  /* TABLES: fit to screen (no horizontal scroll) */
  table {
    max-width: 100% !important;
    border-collapse: collapse;
  }

  td, th {
    vertical-align: top;
  }

  blockquote {
    margin: 0.5rem 0;
    padding-left: 0.75rem;
    border-left: 3px solid rgba(127,127,127,0.35);
  }

  a { color: #0a84ff; }

  hr {
    border: none;
    border-top: 1px solid rgba(127,127,127,0.35);
    margin: 12px 0;
  }
`;


function EmailShadowBody({ html }: { html: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const safeHtml = useMemo(() => sanitizeEmailHtml(html), [html]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });

    // Clear shadow content
    while (shadow.firstChild) shadow.removeChild(shadow.firstChild);

    const styleEl = document.createElement("style");
    styleEl.textContent = SHADOW_EMAIL_CSS;

    const root = document.createElement("div");
    root.className = "email-root";
    root.innerHTML = safeHtml;

    shadow.appendChild(styleEl);
    shadow.appendChild(root);
  }, [safeHtml]);

  // Best practice: ensure the host can shrink inside flex/grid without clipping
  return <div ref={hostRef} className={styles.shadowHost} />;
}

export type DetailBodyProps = {
  account: string;
  mailbox: string;
  email_id: number;
  html?: string | null;
  text?: string | null;
  attachments?: Attachment[];
};

export default function DetailBody(props: DetailBodyProps) {
  const html = props.html ?? "";
  const text = props.text ?? "";
  const hasHtml = html.trim().length > 0;

  const derivedText = useMemo(() => {
    if (text.trim().length) return text;
    if (hasHtml) return htmlToText(html);
    return "";
  }, [text, hasHtml, html]);

  const attachments = props.attachments ?? [];
  const showAttachments = attachments.length > 0;

  const attachmentsInline = showAttachments ? (
    <div className={styles.attachmentsInline}>
      <DetailAttachments
        attachments={attachments}
        account={props.account}
        email_id={props.email_id}
        mailbox={props.mailbox}
      />
    </div>
  ) : null;

  if (hasHtml) {
    return (
      <div className={`${styles.bodyBlock} light-island`}>
        <div className={`${styles.detailBody} light-island`}>
          <EmailShadowBody html={html} />
        </div>
        {attachmentsInline}
      </div>
    );
  }

  const safeText = derivedText.trim().length ? derivedText : "";
  return (
    <div className={`${styles.bodyBlock} light-island`}>
      <pre className={`${styles.detailBody} light-island ${styles.plainText}`}>{safeText}</pre>
      {attachmentsInline}
    </div>
  );
}
