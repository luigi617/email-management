// src/api/auth.ts
import { requestJSON } from "./http";

export type AuthStatus =
  | { mode: "open" }
  | { mode: "required"; authed: boolean; user?: string | null };

export interface LoginResponse {
  ok: boolean;
}

export const AuthApi = {
  async getAuthStatus(): Promise<AuthStatus> {
    return requestJSON<AuthStatus>("/api/auth/status");
  },

  async login(username: string, password: string): Promise<LoginResponse> {
    return requestJSON<LoginResponse>("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
  },

  async logout(): Promise<{ ok: boolean }> {
    return requestJSON<{ ok: boolean }>("/api/logout", {
      method: "POST",
    });
  },
};
