// src/components/Layout/DetailColumn.tsx
import { useMemo, useState, useEffect } from "react";
import type { EmailMessage, EmailOverview, MailboxData } from "../../types/email";
import { getMailboxDisplayName } from "../../utils/emailFormat";
import { getDetailHeader } from "../../utils/detailFormat";
import DetailBody from "../Detail/DetailBody";
import DetailToolbar from "../Detail/DetailToolbar";
import styles from "@/styles/DetailColumn.module.css";

export type DetailColumnProps = {
  selectedOverview: EmailOverview | null;
  selectedMessage: EmailMessage | null;

  mailboxData: MailboxData;
  currentMailbox: string;

  detailError: string;

  getColorForEmail: (email: EmailOverview) => string;

  onArchive: () => void;
  onDelete: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onMove: (destinationMailbox: string) => void;
};

function EmailMessageCard({
  overview,
  message,
  badgeColor,
}: {
  overview: EmailOverview;
  message: EmailMessage | null;
  badgeColor: string;
}) {
  const header = useMemo(() => {
    return getDetailHeader(overview, message);
  }, [overview, message]);

  if (!header) return null;

  return (
    <article className={styles.threadEmailCard}>
      <div className={styles.detailHeader}>
        <span className={styles.detailBadge} style={{ background: badgeColor }} />
        <div className={styles.detailMeta}>
          <div className={styles.detailSubject}>{header.subject}</div>
          <div className={styles.detailLine}>{header.fromLine}</div>
          <div className={styles.detailLine}>{header.toLine}</div>
          <div className={`${styles.detailLine} ${styles.small}`}>{header.dateLine}</div>
        </div>
      </div>

      <hr className={styles.hr} />

      <DetailBody
        account={header.account}
        mailbox={header.mailbox}
        email_id={header.uid as number}
        html={header.html}
        text={header.text}
        attachments={header.attachments}
      />
    </article>
  );
}

export default function DetailColumn(props: DetailColumnProps) {
  const [moveOpen, setMoveOpen] = useState(false);

  const moveOptions = useMemo(() => {
    const ov = props.selectedOverview;
    if (!ov) return [];
    const account = ov.ref.account;
    if (!account) return [];
    return Object.keys(props.mailboxData[account] ?? []);
  }, [props.selectedOverview, props.mailboxData]);

  const [destinationMailbox, setDestinationMailbox] = useState<string>(() => props.currentMailbox);

  useEffect(() => {
    setDestinationMailbox(props.currentMailbox);
  }, [props.currentMailbox, props.selectedOverview]);

  const threadItems = useMemo(() => {
    if (!props.selectedOverview) return [];
    return [
      {
        overview: props.selectedOverview,
        message: props.selectedMessage,
      },
    ];
  }, [props.selectedOverview, props.selectedMessage]);

  return (
    <section className={styles.detailCard}>
      {!props.selectedOverview ? (
        <div id="detail-placeholder">
          <p className={styles.placeholderText}>
            Select an email from the middle column to see its full content here.
          </p>
        </div>
      ) : (
        <div id="email-detail" className={styles.emailDetail}>
          <DetailToolbar
            onArchive={props.onArchive}
            onDelete={props.onDelete}
            onReply={props.onReply}
            onReplyAll={props.onReplyAll}
            onForward={props.onForward}
            onToggleMove={() => setMoveOpen((v) => !v)}
          />

          <div
            id="detail-error"
            className={`${styles.inlineError} ${props.detailError ? "" : styles.hidden}`}
          >
            {props.detailError}
          </div>

          {moveOpen && (
            <div className={styles.movePanel}>
              <label className={styles.moveLabel}>
                Move to:
                <select
                  className={styles.moveSelect}
                  value={destinationMailbox}
                  onChange={(e) => setDestinationMailbox(e.target.value)}
                  id="move-mailbox-select"
                >
                  {moveOptions.map((mb) => (
                    <option key={mb} value={mb}>
                      {getMailboxDisplayName(mb)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.smallButton}`}
                id="move-confirm"
                onClick={() => {
                  if (destinationMailbox) props.onMove(destinationMailbox);
                  setMoveOpen(false);
                }}
              >
                Move
              </button>

              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.smallButton}`}
                id="move-cancel"
                onClick={() => setMoveOpen(false)}
              >
                Cancel
              </button>
            </div>
          )}

          <div className={styles.detailThread} role="list">
            {threadItems.map((item) => (
              <div key={`${item.overview.ref.account}:${item.overview.ref.uid}`} role="listitem">
                <EmailMessageCard
                  overview={item.overview}
                  message={item.message}
                  badgeColor={props.getColorForEmail(item.overview)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
