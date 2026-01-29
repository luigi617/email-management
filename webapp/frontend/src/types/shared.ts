// src/types/shared.ts

export type Priority = "high" | "medium" | "low";

export type ApiErrorPayload = {
  message?: string;
  detail?: string;
};
