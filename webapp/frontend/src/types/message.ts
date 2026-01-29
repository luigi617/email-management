// src/types/message.ts
import type { Address } from "./address";

export type MessageLike = {
  subject?: string;
  date?: string | number | Date;
  html?: string;
  text?: string;
  snippet?: string;

  from_email?: Address;
  to?: Address[];
  cc?: Address[];
};
