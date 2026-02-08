import { useState } from "react";
import type { EmailOverview } from "../../types/email";
import { formatDate } from "../../utils/emailFormat";
import styles from "@/styles/EmailList.module.css";

export type EmailListProps = {
  emails: EmailOverview[];
  selectedEmailId: string | null;
  getColorForEmail: (e: EmailOverview) => string;
  getEmailId: (e: EmailOverview) => string;
  onSelectEmail: (email: EmailOverview) => void;

  // NEW:
  listRef: React.RefObject<HTMLDivElement | null>;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  showLoadingMore: boolean;
  showEnd: boolean;
  emptyList: boolean;
};

function stableFallbackKey(email: EmailOverview, index: number) {
  const a = email.ref.account ?? "";
  const m = email.ref.mailbox ?? "";
  const u = email.ref.uid ?? "";
  const raw = `${a}:${m}:${String(u)}`;
  return raw !== "::" ? raw : `row-${index}`;
}

function isSeenFromFlags(flags: unknown): boolean {
  if (!Array.isArray(flags)) return false;
  return flags.some((f) => {
    const s = String(f).toLowerCase();
    return s.includes("seen") || s === "read" || s.includes("\\seen");
  });
}

export default function EmailList(props: EmailListProps) {
  const [uiSeenKeys, setUiSeenKeys] = useState<Set<string>>(() => new Set());

  return (
    <div
      id="email-list"
      className={styles.emailList}
      ref={(el) => {
        props.listRef.current = el;
      }}
    >
      {props.emails.map((email, index) => {
        const emailId = props.getEmailId(email);
        const key = emailId || stableFallbackKey(email, index);
        const isSelected = !!emailId && emailId === props.selectedEmailId;

        const isSeenFromServer = isSeenFromFlags(email.flags);
        const isSeen = isSeenFromServer || uiSeenKeys.has(key);
        const isUnread = !isSeen;

        const color = props.getColorForEmail(email);
        const fromAddr = email.from_email?.name || email.from_email?.email || "(unknown sender)";
        const dateStr = formatDate(email.received_at);
        const subj = email.subject || "(no subject)";

        const cardClassName = [
          styles.emailCard,
          isSelected ? styles.selected : "",
          isUnread ? styles.unread : styles.read,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={key}
            className={cardClassName}
            onClick={() => {
              setUiSeenKeys((prev) => {
                if (prev.has(key)) return prev;
                const next = new Set(prev);
                next.add(key);
                return next;
              });

              props.onSelectEmail(email);
            }}
            role="button"
            tabIndex={0}
            aria-selected={isSelected}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setUiSeenKeys((prev) => {
                  if (prev.has(key)) return prev;
                  const next = new Set(prev);
                  next.add(key);
                  return next;
                });
                props.onSelectEmail(email);
              }
            }}
          >
            <div className={styles.emailColorStrip} style={{ background: color }} />

            <div className={styles.emailMain}>
              <div className={styles.emailRowTop}>
                <div className={styles.emailFrom}>{fromAddr}</div>
                <div className={styles.emailDate}>{dateStr}</div>
              </div>

              <div className={styles.emailSubject}>{subj}</div>
            </div>
          </div>
        );
      })}

      <div className={`${styles.emptyState} ${props.emptyList ? "" : styles.hidden}`}>
        No emails match the current filters.
      </div>

      {props.showLoadingMore ? <div className={styles.loadingMore}>Loading more…</div> : null}
      {props.showEnd ? <div className={styles.end}>You’re all caught up.</div> : null}

      <div
        className={styles.sentinel}
        ref={(el) => {
          props.sentinelRef.current = el;
        }}
      />
    </div>
  );
}
