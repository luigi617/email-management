import { useMemo, useState, useEffect } from "react";
import type { EmailMessage, EmailOverview, MailboxData } from "../../types/email";
import { getMailboxDisplayName } from "../../utils/emailFormat";
import { getDetailHeader } from "../../utils/detailFormat";
import DetailBody from "../Detail/DetailBody";
import styles from "@/styles/DetailColumn.module.css";
import type { EmailRef } from "../../types/shared";
import DetailToolbar from "../Detail/DetailToolbar";

export type DetailColumnProps = {
  selectedMessages: EmailMessage[] | null;

  mailboxData: MailboxData;
  currentMailbox: string;

  detailError: string;

  onArchive: (ref: EmailRef) => void;
  onDelete: (ref: EmailRef) => void;
  onMove: (ref: EmailRef, destinationMailbox: string) => void;
  onReply: (mgs: EmailMessage) => void;
  onReplyAll: (mgs: EmailMessage) => void;
  onForward: (mgs: EmailMessage) => void;
};

function EmailMessageCard({
  message,
  mailboxData,
  currentMailbox,
  onArchive,
  onDelete,
  onMove,
  onReply,
  onReplyAll,
  onForward,
}: {
  message: EmailMessage | null;
  mailboxData: MailboxData;
  currentMailbox: string;

  onArchive: (ref: EmailRef) => void;
  onDelete: (ref: EmailRef) => void;
  onMove: (ref: EmailRef, destinationMailbox: string) => void;
  onReply: (mgs: EmailMessage) => void;
  onReplyAll: (mgs: EmailMessage) => void;
  onForward: (mgs: EmailMessage) => void;
}) {
  const header = useMemo(() => getDetailHeader(message), [message]);
  const [moveOpen, setMoveOpen] = useState(false);

  const moveOptions = useMemo(() => {
    const account = message?.ref?.account;
    if (!account) return [];
    return Object.keys(mailboxData[account] ?? []);
  }, [message, mailboxData]);

  const [destinationMailbox, setDestinationMailbox] = useState<string>(currentMailbox);

  useEffect(() => {
    setDestinationMailbox(currentMailbox);
    setMoveOpen(false);
  }, [currentMailbox, message]);

  if (!header || !message) return null;

  return (
    <article className={styles.threadEmailCard}>
      <DetailToolbar
        emailMessage={message}
        onArchive={onArchive}
        onDelete={onDelete}
        onReply={onReply}
        onReplyAll={onReplyAll}
        onForward={onForward}
        onToggleMove={() => setMoveOpen((v) => !v)}
      />

      {moveOpen && (
        <div className={styles.movePanel}>
          <label className={styles.moveLabel}>
            Move to:
            <select
              className={styles.moveSelect}
              value={destinationMailbox}
              onChange={(e) => setDestinationMailbox(e.target.value)}
              id={`move-mailbox-select-${message.ref.uid}`}
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
            onClick={() => {
              if (destinationMailbox) onMove(message.ref, destinationMailbox);
              setMoveOpen(false);
            }}
          >
            Move
          </button>

          <button
            type="button"
            className={`${styles.secondaryButton} ${styles.smallButton}`}
            onClick={() => setMoveOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      <div className={styles.detailHeader}>
        <div className={styles.detailMeta}>
          <div className={styles.detailSubject}>{header.subject}</div>
          <div className={styles.detailLine}>{header.fromLine}</div>
          <div className={styles.detailLine}>{header.toLine}</div>
          <div className={`${styles.detailLine} ${styles.small}`}>{header.dateLine}</div>
        </div>
      </div>
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
  return (
    <section className={styles.detailCard}>
      {!props.selectedMessages ? (
        <div id="detail-placeholder">
          <p className={styles.placeholderText}>
            Select an email from the middle column to see its full content here.
          </p>
        </div>
      ) : (
        <div id="email-detail" className={styles.emailDetail}>
          <div
            id="detail-error"
            className={`${styles.inlineError} ${props.detailError ? "" : styles.hidden}`}
          >
            {props.detailError}
          </div>

          <div className={styles.detailThread} role="list">
            {props.selectedMessages?.map((msg) => (
              <div key={`${msg.ref.account}:${msg.ref.uid}`} role="listitem">
                <EmailMessageCard
                  message={msg}
                  mailboxData={props.mailboxData}
                  currentMailbox={props.currentMailbox}
                  onArchive={props.onArchive}
                  onDelete={props.onDelete}
                  onMove={props.onMove}
                  onReply={props.onReply}
                  onReplyAll={props.onReplyAll}
                  onForward={props.onForward}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
