// src/utils/emailFormat.ts
import type { Address } from "../types/address";
import type { MailboxData, OverviewLike } from "../types/legacy";

export const COLOR_PALETTE = [
  "#f97316",
  "#22c55e",
  "#0ea5e9",
  "#a855f7",
  "#ec4899",
  "#eab308",
  "#10b981",
  "#f97373",
] as const;

export function formatDate(value: unknown, verbose?: boolean): string {
  if (!value) return "";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return String(value);

  if (verbose) {
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function escapeHtml(str: unknown): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatAddress(addr?: Address | null): string {
  if (!addr) return "";
  if (addr.name && addr.email) return `${addr.name} <${addr.email}>`;
  if (addr.name) return addr.name;
  return addr.email || "";
}

export function formatAddressList(list?: Address[] | null): string {
  if (!Array.isArray(list)) return "";
  return list.map(formatAddress).filter(Boolean).join(", ");
}

export function getEmailId(email?: OverviewLike | null): string {
  if (!email) return "";
  const ref = email.ref || {};
  if (ref.uid != null) {
    const account = ref.account || "";
    const mailbox = ref.mailbox || "";
    return `${account}:${mailbox}:${String(ref.uid)}`;
  }
  if (email.uid != null) return String(email.uid);
  return "";
}

export function getAccountKey(email?: OverviewLike | null): string {
  if (!email) return "unknown";
  const ref = email.ref || {};
  return ref.account || email.account || "unknown";
}

export function findAccountForEmail(email: OverviewLike | null | undefined, mailboxData: MailboxData): string {
  if (!email) return "unknown";

  const ref = email.ref || {};
  if (ref.account) return ref.account;

  const mailboxAccounts = Object.keys(mailboxData || {});
  if (!mailboxAccounts.length) return getAccountKey(email);

  const toList = Array.isArray(email.to) ? email.to : [];
  const toEmails = new Set(
    toList
      .map((a) => (a?.email ? a.email.toLowerCase() : ""))
      .filter(Boolean)
  );

  for (const account of mailboxAccounts) {
    if (toEmails.has(String(account).toLowerCase())) return account;
  }

  if (email.to_address) {
    const rawTo = String(email.to_address).toLowerCase();
    for (const account of mailboxAccounts) {
      if (rawTo.includes(String(account).toLowerCase())) return account;
    }
  }

  return getAccountKey(email);
}

export function buildColorMap(emails: OverviewLike[], mailboxData: MailboxData): Record<string, string> {
  const map: Record<string, string> = {};
  let colorIndex = 0;

  for (const account of Object.keys(mailboxData || {})) {
    if (!map[account]) {
      map[account] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
      colorIndex++;
    }
  }

  for (const email of emails || []) {
    const key = findAccountForEmail(email, mailboxData);
    if (!map[key]) {
      map[key] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
      colorIndex++;
    }
  }

  return map;
}

export function getColorForEmail(
  email: OverviewLike,
  mailboxData: MailboxData,
  colorMap: Record<string, string>
): string {
  const key = findAccountForEmail(email, mailboxData);
  return colorMap?.[key] || "#9ca3af";
}

export function getMailboxDisplayName(raw: unknown): string {
  if (!raw) return "";

  let name = String(raw).trim();

  const gmailPrefix = "[Gmail]/";
  if (name.startsWith(gmailPrefix)) name = name.slice(gmailPrefix.length).trim();

  name = name.replace(/^INBOX[/.]/i, "").trim();

  const slashIdx = name.lastIndexOf("/");
  const dotIdx = name.lastIndexOf(".");
  const sepIdx = Math.max(slashIdx, dotIdx);
  if (sepIdx !== -1) name = name.slice(sepIdx + 1).trim();

  const lower = name.toLowerCase();

  const specialMap: Record<string, string> = {
    inbox: "Inbox",
    sent: "Sent",
    "sent mail": "Sent",
    "sent items": "Sent",
    "sent messages": "Sent",
    draft: "Drafts",
    drafts: "Drafts",
    trash: "Trash",
    bin: "Trash",
    "deleted items": "Trash",
    "deleted messages": "Trash",
    spam: "Spam",
    junk: "Spam",
    "junk e-mail": "Spam",
    "bulk mail": "Spam",
    archive: "Archive",
    "all mail": "All mail",
    important: "Important",
    starred: "Starred",
  };

  if (specialMap[lower]) return specialMap[lower];
  return name.charAt(0).toUpperCase() + name.slice(1);
}
