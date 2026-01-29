// src/types/legacy.ts
import type { Address } from "./address";

export type EmailRef = {
  account?: string;
  mailbox?: string;
  uid?: string | number;
};

export type OverviewLike = {
  ref?: EmailRef;
  uid?: string | number;
  account?: string;
  mailbox?: string;

  to?: Address[];
  to_address?: string;

  from_email?: Address;

  subject?: string;
  snippet?: string;
  date?: string | number | Date;
};

// account -> mailboxes
export type MailboxData = Record<string, string[]>;
