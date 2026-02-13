import { useState } from 'react';
import type { EmailOverview } from '../../types/email';
import { formatDate } from '../../utils/emailFormat';
import styles from '@/styles/EmailList.module.css';
import { EmailApi } from '../../api/emailApi';

export type EmailListProps = {
  emails: EmailOverview[];
  selectedOverview: EmailOverview | null;
  getColorForEmail: (e: EmailOverview) => string;
  getEmailId: (e: EmailOverview) => string;
  onSelectEmail: (email: EmailOverview) => void;

  listRef: React.RefObject<HTMLDivElement | null>;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  showLoadingMore: boolean;
  showEnd: boolean;
  emptyList: boolean;
};

function stableFallbackKey(email: EmailOverview, index: number) {
  const a = email.ref.account ?? '';
  const m = email.ref.mailbox ?? '';
  const u = email.ref.uid ?? '';
  const raw = `${a}:${m}:${String(u)}`;
  return raw !== '::' ? raw : `row-${index}`;
}

function isSeenFromFlags(flags: unknown): boolean {
  if (!Array.isArray(flags)) return false;
  return flags.some((f) => {
    const s = String(f).toLowerCase();
    return s.includes('seen') || s === 'read' || s.includes('\\seen');
  });
}

function isStarredFromFlags(flags: unknown): boolean {
  if (!Array.isArray(flags)) return false;
  return flags.some((f) => {
    const s = String(f).toLowerCase();
    return s.includes('flagged') || s.includes('\\flagged') || s === 'starred';
  });
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 17.27l5.18 3.73-1.64-6.03L20 10.24l-6.19-.52L12 4 10.19 9.72 4 10.24l4.46 4.73L6.82 21z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function EmailList(props: EmailListProps) {
  const [uiSeenKeys, setUiSeenKeys] = useState<Set<string>>(() => new Set());

  // optimistic starred overrides
  const [uiStarOn, setUiStarOn] = useState<Set<string>>(() => new Set());
  const [uiStarOff, setUiStarOff] = useState<Set<string>>(() => new Set());
  const [starBusy, setStarBusy] = useState<Set<string>>(() => new Set());

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

        const selectedEmailId = props.selectedOverview
          ? props.getEmailId(props.selectedOverview)
          : null;
        const isSelected = !!emailId && emailId === selectedEmailId;

        const isSeenFromServer = isSeenFromFlags(email.flags);
        const isSeen = isSeenFromServer || uiSeenKeys.has(key);
        const isUnread = !isSeen;

        const starredFromServer = isStarredFromFlags(email.flags);

        const isStarred = (starredFromServer && !uiStarOff.has(key)) || uiStarOn.has(key);

        const isStarBusy = starBusy.has(key);

        const color = props.getColorForEmail(email);
        const fromAddr = email.from_email?.name || email.from_email?.email || '(unknown sender)';
        const dateStr = formatDate(email.received_at);
        const subj = email.subject || '(no subject)';

        const cardClassName = [
          styles.emailCard,
          isSelected ? styles.selected : '',
          isUnread ? styles.unread : styles.read,
        ]
          .filter(Boolean)
          .join(' ');

        const toggleStarred = async () => {
          const account = email.ref.account;
          const mailbox = email.ref.mailbox;
          const uid = email.ref.uid;

          if (!account || !mailbox || uid == null) return;
          if (isStarBusy) return;

          const nextStarred = !isStarred;

          // optimistic busy
          setStarBusy((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });

          // optimistic override sets
          setUiStarOn((prev) => {
            const next = new Set(prev);
            if (nextStarred) next.add(key);
            else next.delete(key);
            return next;
          });

          setUiStarOff((prev) => {
            const next = new Set(prev);
            if (!nextStarred) next.add(key);
            else next.delete(key);
            return next;
          });

          try {
            await EmailApi.setFlagged({
              account,
              mailbox,
              uid,
              flagged: nextStarred,
            });
          } catch (err) {
            // revert on failure
            setUiStarOn((prev) => {
              const next = new Set(prev);
              if (nextStarred) next.delete(key);
              else next.add(key);
              return next;
            });
            setUiStarOff((prev) => {
              const next = new Set(prev);
              if (!nextStarred) next.delete(key);
              else next.add(key);
              return next;
            });
            console.error(err);
          } finally {
            setStarBusy((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          }
        };

        const starDisabled =
          isStarBusy || !email.ref.account || !email.ref.mailbox || email.ref.uid == null;

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
              if (e.key === 'Enter' || e.key === ' ') {
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
              {/* Row 1: From (left) + Date (right) */}
              <div className={styles.emailRowTop}>
                <div className={styles.emailFrom}>{fromAddr}</div>
                <div className={styles.emailDate}>{dateStr}</div>
              </div>

              {/* Row 2: Subject (left) + Star (right) */}
              <div className={styles.emailRowBottom}>
                <div className={styles.emailSubject}>{subj}</div>

                <button
                  type="button"
                  className={[styles.starButton, isStarred ? styles.starButtonActive : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={isStarred ? 'Unstar email' : 'Star email'}
                  aria-pressed={isStarred}
                  disabled={starDisabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // don't trigger card select
                    toggleStarred();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <StarIcon filled={isStarred} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div className={`${styles.emptyState} ${props.emptyList ? '' : styles.hidden}`}>
        No emails match the current filters.
      </div>

      {props.showLoadingMore ? <div className={styles.loadingMore}>Loading more…</div> : null}
      {props.showEnd ? <div className={styles.end}>You're all caught up.</div> : null}

      <div
        className={styles.sentinel}
        ref={(el) => {
          props.sentinelRef.current = el;
        }}
      />
    </div>
  );
}
