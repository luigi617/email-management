// Settings.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccountAuth, AccountProvider, AccountRow } from "../types/accountApi";
import { AccountApi } from "../api/accountApi";
import { EmailApi } from "../api/emailApi";
import styles from "@/styles/Settings.module.css";
import Button from "../components/ui/Button/Button";

const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN;
const MOBILE_BREAKPOINT = 960;

type PanelMode = "view" | "create" | "edit";
type ConnectedMap = Record<string, { ok: boolean; detail: string }>;

function isConnected(a: AccountRow, connectedById: ConnectedMap) {
  return connectedById[String(a.id)]?.ok ?? false;
}

type Props = {
  onAccountsChanged?: () => void;
};

/** Local modal (only used on mobile) */
function SettingsModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modalSheet} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{title ?? "Details"}</div>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

export default function Settings({ onAccountsChanged }: Props) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // connection map (imap/smtp health status)
  const [connectedById, setConnectedById] = useState<ConnectedMap>({});

  // selection + panel mode
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("view");

  // rail search
  const [query, setQuery] = useState("");

  // mobile behavior
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // create/edit form state
  const [provider, setProvider] = useState<AccountRow["provider"]>("gmail");
  const [email, setEmail] = useState("");
  const [authMethod, setAuthMethod] = useState<AccountRow["auth_method"]>("app");

  const [password, setPassword] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState(
    `${BACKEND_ORIGIN}/api/accounts/oauth/callback`
  );
  const [scopes, setScopes] = useState("");

  // mobile breakpoint
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return accounts.find((a) => String(a.id) === selectedId) ?? null;
  }, [accounts, selectedId]);

  const connectedCount = useMemo(
    () => accounts.filter((a) => isConnected(a, connectedById)).length,
    [accounts, connectedById]
  );

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => {
      return (
        a.email.toLowerCase().includes(q) ||
        a.provider.toLowerCase().includes(q) ||
        a.auth_method.toLowerCase().includes(q)
      );
    });
  }, [accounts, query]);

  function resetForm(
    next?: Partial<{ provider: AccountRow["provider"]; email: string; auth: AccountAuth }>
  ) {
    setProvider(next?.provider ?? "gmail");
    setEmail(next?.email ?? "");
    setAuthMethod(next?.auth ?? "app");
    setPassword("");
    setClientId("");
    setClientSecret("");
    setScopes("");
    setRedirectUri(`${BACKEND_ORIGIN}/api/accounts/oauth/callback`);
  }

  /** List accounts only (NO connection checks) */
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await AccountApi.listAccounts();
      setAccounts(rows);

      // keep selection valid WITHOUT capturing selectedId in deps
      setSelectedId((prev) => {
        if (!prev) return prev;
        const stillExists = rows.some((r) => String(r.id) === prev);
        return stillExists ? prev : null;
      });

      // if selection got cleared, also reset panel/mobile safely
      setPanelMode((prevMode) => prevMode); // no-op unless you want to force "view"
      setMobileOpen((prevOpen) => {
        // close only if selected got cleared
        // (we can't see the new selectedId here, so keep it simple or handle with another effect)
        return prevOpen;
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  /** Connection/health checks (only runs when user asks, on mount, after save/delete, or OAuth success) */
  const refreshStatus = useCallback(
    async (rowsOverride?: AccountRow[]) => {
      setChecking(true);
      setErr(null);
      try {
        const rows = rowsOverride ?? (await AccountApi.listAccounts());
        if (!rowsOverride) setAccounts(rows);

        const entries = await Promise.all(
          rows.map(async (a) => {
            try {
              const key = a.email;

              if (a.auth_method === "app" && !a.has_password) {
                return [String(a.id), { ok: false, detail: "needs app password" }] as const;
              }
              if (a.auth_method === "oauth2" && !a.has_refresh_token) {
                return [String(a.id), { ok: false, detail: "needs OAuth" }] as const;
              }

              const res = await EmailApi.isAccountConnected(key);
              return [String(a.id), { ok: !!res.result, detail: res.detail }] as const;
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : "health check failed";
              return [String(a.id), { ok: false, detail: message }] as const;
            }
          })
        );

        setConnectedById(Object.fromEntries(entries));
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setChecking(false);
      }
    },
    []
  );

  // initial load: list accounts + run status check once
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const rows = await AccountApi.listAccounts();
        setAccounts(rows);
        void refreshStatus(rows); // runs once on mount
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshStatus]);


  // OAuth popup -> postMessage listener
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== BACKEND_ORIGIN) return;
      if (event.data?.type === "oauth-success") {
        // do NOT tie this to selection; only update list + statuses
        (async () => {
          const rows = await AccountApi.listAccounts();
          setAccounts(rows);
          await refreshStatus(rows);
          onAccountsChanged?.();
        })();
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refreshStatus, onAccountsChanged]);

  // ---- navigation actions (NO status checks here) ----
  function beginView(a: AccountRow) {
    setErr(null);
    setSelectedId(String(a.id));
    setPanelMode("view");
    if (isMobile) setMobileOpen(true);
  }

  function beginCreate() {
    setErr(null);
    setSelectedId(null);
    setPanelMode("create");
    resetForm();
    if (isMobile) setMobileOpen(true);
  }

  function beginEdit(a: AccountRow) {
    setErr(null);
    setSelectedId(String(a.id));
    setPanelMode("edit");

    setProvider(a.provider);
    setEmail(a.email);
    setAuthMethod(a.auth_method);

    // secrets are not returned for security, so leave blank
    setPassword("");
    setClientId("");
    setClientSecret("");
    setScopes("");
    setRedirectUri(`${BACKEND_ORIGIN}/api/accounts/oauth/callback`);

    if (isMobile) setMobileOpen(true);
  }

  function cancelEdit() {
    setErr(null);
    setPanelMode("view");
    resetForm();
    if (isMobile) setMobileOpen(false);
  }

  // ---- operations ----
  async function handleSave() {
    setErr(null);

    try {
      if (authMethod === "app") {
        if (!email.trim()) throw new Error("Email is required");
        if (!password.trim() && panelMode === "create") throw new Error("Password is required");

        if (panelMode === "create") {
          await AccountApi.createOrUpdateAppAccount({ provider, email, password });
        } else {
          if (!selected) throw new Error("No account selected");
          if (!password.trim()) throw new Error("Enter new password to update");
          await AccountApi.updateAccountSecrets(selected.id, { password });
        }
      } else if (authMethod === "oauth2") {
        if (provider === "icloud") throw new Error("iCloud does not support OAuth2");
        if (!email.trim()) throw new Error("Email is required");

        if (panelMode === "create") {
          if (!clientId.trim()) throw new Error("Client ID is required");
          if (!clientSecret.trim()) throw new Error("Client secret is required");
          if (!redirectUri.trim()) throw new Error("Redirect URI is required");

          const res = await AccountApi.createOrUpdateOAuth2Account({
            provider: provider as Exclude<AccountRow["provider"], "icloud">,
            email,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            scopes: scopes.trim() ? scopes.trim() : undefined,
          });

          window.open(res.authorize_url, "_blank", "width=500,height=700");
        } else {
          if (!selected) throw new Error("No account selected");
          type OAuth2SecretPatch = Partial<{ client_id: string; client_secret: string }>;

          const patch: OAuth2SecretPatch = {};
          if (clientId.trim()) patch.client_id = clientId.trim();
          if (clientSecret.trim()) patch.client_secret = clientSecret.trim();
          if (Object.keys(patch).length === 0)
            throw new Error("Enter client_id and/or client_secret to update");

          await AccountApi.updateAccountSecrets(selected.id, patch);
        }
      } else {
        throw new Error("Unsupported auth method");
      }

      // reload list + status (still not tied to selecting an account)
      const rows = await AccountApi.listAccounts();
      setAccounts(rows);
      await refreshStatus(rows);

      onAccountsChanged?.();

      // after create: select newly created by email (best effort)
      if (panelMode === "create") {
        const newly = rows.find((r) => r.email === email);
        if (newly) setSelectedId(String(newly.id));
      }

      setPanelMode("view");
      resetForm();
      if (isMobile) setMobileOpen(true); // keep modal open showing view state
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(a: AccountRow) {
    const ok = window.confirm(`Delete account "${a.email}"?`);
    if (!ok) return;

    setErr(null);
    try {
      await AccountApi.deleteAccount(a.id);

      const rows = await AccountApi.listAccounts();
      setAccounts(rows);
      await refreshStatus(rows);

      onAccountsChanged?.();

      if (selectedId === String(a.id)) {
        setSelectedId(null);
        setPanelMode("view");
        setMobileOpen(false);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleReconnect(a: AccountRow) {
    setErr(null);
    try {
      if (a.auth_method !== "oauth2") return;
      const res = await AccountApi.startOAuthExistingAccount(
        a.id,
        redirectUri,
        scopes.trim() ? scopes.trim() : undefined
      );
      window.open(res.authorize_url, "_blank", "width=500,height=700");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const rightTitle =
    panelMode === "create"
      ? "Add account"
      : panelMode === "edit"
      ? "Edit account"
      : selected
      ? "Account details"
      : "Accounts";

  // Right panel content extracted so we can render in desktop panel or mobile modal
  const rightPanel = (
    <>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>{rightTitle}</div>
          <div className={styles.subtle}>
            {panelMode === "create"
              ? "Add an email account and connect it."
              : selected
              ? `${selected.provider} • ${selected.auth_method}`
              : "Select an account on the left to view details."}
          </div>
        </div>

        <div className={styles.panelHeaderActions}>
          {selected && panelMode === "view" ? (
            <>
              <Button variant="secondary" onClick={() => beginEdit(selected)}>
                Edit
              </Button>
              <Button variant="secondary" onClick={() => void handleDelete(selected)}>
                Remove
              </Button>
            </>
          ) : null}

          {panelMode !== "view" ? (
            <Button variant="secondary" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <div className={styles.panelBody}>
        {panelMode === "view" ? (
          selected ? (
            <div className={styles.section}>
              <div className={styles.kvGrid}>
                <div className={styles.kv}>
                  <div className={styles.k}>Email</div>
                  <div className={styles.v}>{selected.email}</div>
                </div>
                <div className={styles.kv}>
                  <div className={styles.k}>Provider</div>
                  <div className={styles.v}>{selected.provider}</div>
                </div>
                <div className={styles.kv}>
                  <div className={styles.k}>Auth</div>
                  <div className={styles.v}>{selected.auth_method}</div>
                </div>
                <div className={styles.kv}>
                  <div className={styles.k}>Status</div>
                  <div className={styles.v}>
                    {isConnected(selected, connectedById) ? "Connected" : "Not connected"}{" "}
                    <span className={styles.subtle}>
                      • {connectedById[String(selected.id)]?.detail ?? "status unknown"}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.sectionActions}>
                <Button variant="secondary" onClick={() => void refreshStatus(accounts)} loading={checking}>
                  Refresh status
                </Button>

                {selected.auth_method === "oauth2" ? (
                  <Button variant="secondary" onClick={() => void handleReconnect(selected)}>
                    {isConnected(selected, connectedById) ? "Reconnect (OAuth)" : "Connect (OAuth)"}
                  </Button>
                ) : null}

                {selected.auth_method === "app" && !isConnected(selected, connectedById) ? (
                  <Button variant="primary" onClick={() => beginEdit(selected)}>
                    Connect with app password
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={styles.emptyBig}>
              <div className={styles.emptyBigTitle}>Choose an account</div>
              <div className={styles.subtle}>Select one on the left, or add a new account.</div>
              <div style={{ marginTop: 12 }}>
                <Button variant="primary" onClick={beginCreate}>
                  Add account
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className={styles.section}>
            <div className={styles.formGrid}>
              <label className={styles.label}>
                Provider
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as AccountProvider)}
                  disabled={panelMode === "edit"}
                >
                  <option value="gmail">gmail</option>
                  <option value="outlook">outlook</option>
                  <option value="yahoo">yahoo</option>
                  <option value="icloud">icloud</option>
                </select>
              </label>

              <label className={styles.label}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={panelMode === "edit"}
                />
              </label>

              <label className={styles.label}>
                Auth method
                <select
                  value={authMethod}
                  onChange={(e) => setAuthMethod(e.target.value as AccountAuth)}
                  disabled={panelMode === "edit"}
                >
                  <option value="app">app</option>
                  <option value="oauth2">oauth2</option>
                  <option value="no-auth">no-auth</option>
                </select>
              </label>
            </div>

            {authMethod === "app" ? (
              <div className={styles.formGrid} style={{ marginTop: 12 }}>
                <label className={styles.label} style={{ gridColumn: "1 / -1" }}>
                  App password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      panelMode === "edit"
                        ? selected?.has_password
                          ? "Enter new password to rotate"
                          : "Enter app password to connect"
                        : ""
                    }
                  />
                  {panelMode === "edit" && selected && !connectedById[String(selected.id)]?.ok ? (
                    <div className={styles.subtle}>
                      This account isn’t connected yet — enter the app password and click Save.
                    </div>
                  ) : null}
                </label>
              </div>
            ) : null}

            {authMethod === "oauth2" ? (
              <>
                <div className={styles.formGrid} style={{ marginTop: 12 }}>
                  <label className={styles.label}>
                    Client ID
                    <input
                      type="password"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder={panelMode === "edit" ? "Enter to rotate (optional)" : ""}
                    />
                  </label>

                  <label className={styles.label}>
                    Client secret
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder={panelMode === "edit" ? "Enter to rotate (optional)" : ""}
                    />
                  </label>

                  <label className={styles.label} style={{ gridColumn: "1 / -1" }}>
                    Redirect URI
                    <input
                      type="text"
                      value={redirectUri}
                      onChange={(e) => setRedirectUri(e.target.value)}
                    />
                  </label>

                  <label className={styles.label} style={{ gridColumn: "1 / -1" }}>
                    Scopes (optional)
                    <input
                      type="text"
                      value={scopes}
                      onChange={(e) => setScopes(e.target.value)}
                      placeholder="leave blank to use backend defaults"
                    />
                  </label>
                </div>

                {panelMode === "edit" && selected ? (
                  <div className={styles.inlineActions} style={{ marginTop: 12 }}>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setErr(null);
                        try {
                          await AccountApi.updateAccountSecrets(selected.id, {
                            clear_refresh_token: true,
                          });
                          const rows = await AccountApi.listAccounts();
                          setAccounts(rows);
                          await refreshStatus(rows);
                          onAccountsChanged?.();
                        } catch (e: unknown) {
                          setErr(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      Clear refresh token
                    </Button>

                    <Button variant="secondary" onClick={() => void handleReconnect(selected)}>
                      Reconnect (OAuth)
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className={styles.formFooter}>
              <div className={styles.subtle}>
                OAuth2: complete consent in the popup. App-password: Save stores the password to
                enable IMAP/SMTP.
              </div>
              <div className={styles.formFooterActions}>
                <Button variant="secondary" onClick={() => void refreshStatus(accounts)} loading={checking}>
                  Re-check status
                </Button>
                <Button variant="primary" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <h2 className={styles.h2}>Settings</h2>
          <div className={styles.subtle}>
            {loading ? "Loading…" : `${connectedCount}/${accounts.length} connected`}
          </div>
        </div>

        <div className={styles.topbarActions}>
          <Button variant="secondary" onClick={() => void refreshStatus(accounts)} loading={checking}>
            Refresh status
          </Button>
          <Button variant="primary" onClick={beginCreate}>
            Add account
          </Button>
        </div>
      </div>

      {err ? (
        <div className={styles.bannerError} role="alert">
          {err}
        </div>
      ) : null}

      <div className={styles.shell}>
        <aside className={styles.rail} aria-label="Accounts list">
          <div className={styles.railHeader}>
            <div className={styles.railTitle}>Accounts</div>
            <input
              className={styles.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search accounts…"
              aria-label="Search accounts"
            />
          </div>

          {filteredAccounts.length === 0 ? (
            <div className={styles.emptySmall}>
              {accounts.length === 0 ? "No accounts yet." : "No matches."}
            </div>
          ) : (
            <div className={styles.railList}>
              {filteredAccounts.map((a) => {
                const id = String(a.id);
                const status = connectedById[id];
                const connected = isConnected(a, connectedById);
                const active = selectedId === id && panelMode !== "create";

                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`${styles.railItem} ${active ? styles.railItemActive : ""}`}
                    onClick={() => beginView(a)} // <-- NO status checks on click
                  >
                    <div className={styles.railItemTop}>
                      <div className={styles.railEmail}>{a.email}</div>
                      <span
                        className={`${styles.badge} ${connected ? styles.badgeOk : styles.badgeBad}`}
                        aria-label={connected ? "Connected" : "Not connected"}
                      >
                        {connected ? "Connected" : "Not connected"}
                      </span>
                    </div>
                    <div className={styles.railMeta}>
                      {a.provider} • {a.auth_method}
                      {status ? ` • ${status.detail}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles.railFooter}>
            <div className={styles.subtle}>Tip: status updates when you click “Refresh status”.</div>
          </div>
        </aside>

        {!isMobile ? <main className={styles.panel}>{rightPanel}</main> : null}
      </div>

      <SettingsModal
        open={isMobile && mobileOpen}
        title={rightTitle}
        onClose={() => setMobileOpen(false)}
      >
        {rightPanel}
      </SettingsModal>
    </div>
  );
}
