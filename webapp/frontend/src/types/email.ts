// src/types/email.ts

export type Mailbox = {
  id: string;
  name: string;
};

export type LegendAccount = {
  id: string;
  label: string;
  color: string;
};

export type EmailKey = {
  account: string;
  mailbox: string;
  uid: string;
};

export type EmailPreview = EmailKey & {
  id: string;
  subject: string;
  from: string;
  snippet: string;
};

export type EmailDetail = EmailKey & {
  id: string;
  subject: string;
  from: string;
  to: string;
  datetime: string;

  // Bodies
  bodyHtml?: string | null;
  bodyText?: string | null;

  // If this is purely derived from account -> color, consider removing later
  accountColor?: string;
};
