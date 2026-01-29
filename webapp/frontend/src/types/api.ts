// src/types/api.ts

import type { EmailKey } from "./email";
import type { Priority } from "./shared";

export type OverviewParams = {
  mailbox?: string;
  limit?: number;
  cursor?: string;
  accounts?: string[];
};

export type OverviewResponse<TEmail> = {
  data: TEmail[];
  meta?: {
    next_cursor?: string | null;
    prev_cursor?: string | null;
    result_count?: number | null;
    total_count?: number | null;
  };
};

export type SendLikeBase = {
  account: string;
  subject?: string;
  to?: string[];
  fromAddr?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  priority?: Priority;
  attachments?: File[];
};

export type SendEmailParams = SendLikeBase & {
  text?: string;
  html?: string;
};

export type SaveDraftParams = SendLikeBase & {
  text?: string;
  html?: string;
  draftsMailbox?: string;
};

export type ReplyParams = EmailKey & {
  body?: string;
  bodyHtml?: string;
  fromAddr?: string;
  quoteOriginal?: boolean;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  replyTo?: string[];
  priority?: Priority;
  attachments?: File[];
};

export type ForwardParams = EmailKey & {
  to?: string[];
  body?: string;
  bodyHtml?: string;
  fromAddr?: string;
  includeOriginal?: boolean;
  includeAttachments?: boolean;
  cc?: string[];
  bcc?: string[];
  subject?: string;
  replyTo?: string[];
  priority?: Priority;
  attachments?: File[];
};
