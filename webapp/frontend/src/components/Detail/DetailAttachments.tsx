import { useMemo } from "react";
import type { Attachment } from "../../types/email";
import DownloadIcon from "../../assets/svg/download.svg?react";
import styles from "@/styles/DetailAttachments.module.css";

export type DetailAttachmentsProps = {
  attachments?: (Attachment | null | undefined)[] | null;
  account: string;
  mailbox: string;
  email_id: number;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const decimals = i === 0 ? 0 : v < 10 ? 1 : 0;
  return `${v.toFixed(decimals)} ${units[i]}`;
}

function safeFilename(name: string) {
  const cleaned = name.replace(/[<>:"/\\|?*]/g, "_").trim();
  const withoutControls = Array.from(cleaned, (ch) =>
    ch.charCodeAt(0) < 32 ? "_" : ch
  ).join("");
  return withoutControls || "attachment";
}

function buildDownloadUrl(params: {
  account: string;
  mailbox: string;
  email_id: number;
  part: string;
  filename: string;
  content_type: string;
}): string {
  const { account, mailbox, email_id, part, filename, content_type } = params;

  const base =
    `/api/accounts/${encodeURIComponent(account)}` +
    `/mailboxes/${encodeURIComponent(mailbox)}` +
    `/emails/${encodeURIComponent(String(email_id))}` +
    `/attachment`;

  const qs = new URLSearchParams();
  qs.set("part", part);

  if (filename) qs.set("filename", safeFilename(filename));
  if (content_type) qs.set("content_type", content_type);

  return `${base}?${qs.toString()}`;
}

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function DetailAttachments(props: DetailAttachmentsProps) {
  const attachments = useMemo(() => {
    const a = props.attachments ?? [];
    return Array.isArray(a)
      ? (a.filter((att) => att && !att.is_inline) as Attachment[])
      : [];
  }, [props.attachments]);

  if (attachments.length === 0) return null;

  return (
    <div className={styles.detailAttachments} id="detail-attachments">
      <div className={`${styles.title} ${styles.detailLine}`}>
        Attachments
      </div>

      <div
        className={styles.strip}
        role="list"
        aria-label="Attachments"
      >
        {attachments.map((att, idx) => {
          const fullName = att.filename || `Attachment ${idx + 1}`;
          const size =
            typeof att.size === "number" ? formatBytes(att.size) : "";

          const part = att.part;
          const canDownload = Boolean(part && part.trim().length > 0);

          const url = canDownload
            ? buildDownloadUrl({
                account: props.account,
                mailbox: props.mailbox,
                email_id: props.email_id,
                part: part!.trim(),
                filename: att.filename,
                content_type: att.content_type,
              })
            : "";

          const onActivate = () => {
            if (!canDownload) return;
            triggerDownload(url);
          };

          const cardClass = [
            styles.card,
            !canDownload ? styles.disabled : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={att.idx ?? `${fullName}-${idx}`}
              className={cardClass}
              role="listitem"
              title={fullName}
              tabIndex={canDownload ? 0 : -1}
              aria-disabled={!canDownload}
              onClick={onActivate}
              onKeyDown={(e) => {
                if (!canDownload) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onActivate();
                }
              }}
            >
              <div className={styles.cardMain}>
                <div className={styles.cardName} title={fullName}>
                  {fullName}
                </div>
                <div
                  className={`${styles.cardSize} ${styles.detailLine} ${styles.small}`}
                >
                  {size || " "}
                </div>
              </div>

              {canDownload ? (
                <a
                  className={`${styles.iconBtn} ${styles.cardAction}`}
                  href={url}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Download ${fullName}`}
                  title={`Download ${fullName}`}
                >
                  <DownloadIcon className={styles.icon} aria-hidden />
                </a>
              ) : (
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.cardAction}`}
                  disabled
                  aria-label={`Download ${fullName}`}
                  title="No attachment part available"
                >
                  <DownloadIcon className={styles.icon} aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
