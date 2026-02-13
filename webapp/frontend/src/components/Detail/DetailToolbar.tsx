import ArchiveIcon from '@/assets/svg/box-archive.svg?react';
import DeleteIcon from '@/assets/svg/delete.svg?react';
import ReplyIcon from '@/assets/svg/reply.svg?react';
import ReplyAllIcon from '@/assets/svg/reply-all.svg?react';
import ForwardIcon from '@/assets/svg/forward.svg?react';
import FolderIcon from '@/assets/svg/folder.svg?react';
import styles from '@/styles/DetailToolbar.module.css';
import type { EmailRef } from '../../types/shared';
import type { EmailMessage } from '../../types/email';

export type DetailToolbarProps = {
  emailMessage: EmailMessage;
  onArchive: (ref: EmailRef) => void;
  onDelete: (ref: EmailRef) => void;
  onReply: (msg: EmailMessage) => void;
  onReplyAll: (msg: EmailMessage) => void;
  onForward: (msg: EmailMessage) => void;
  onToggleMove: (ref: EmailRef) => void;
};

export default function DetailToolbar(props: DetailToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={styles.iconBtn}
        title="Archive"
        aria-label="Archive"
        onClick={() => props.onArchive(props.emailMessage.ref)}
      >
        <ArchiveIcon className={styles.icon} aria-hidden />
      </button>

      <button
        type="button"
        className={styles.iconBtn}
        title="Delete"
        aria-label="Delete"
        onClick={() => props.onDelete(props.emailMessage.ref)}
      >
        <DeleteIcon className={styles.icon} aria-hidden />
      </button>

      <span className={styles.separator} />

      <button
        type="button"
        className={styles.iconBtn}
        title="Reply"
        aria-label="Reply"
        onClick={() => props.onReply(props.emailMessage)}
      >
        <ReplyIcon className={styles.icon} aria-hidden />
      </button>

      <button
        type="button"
        className={styles.iconBtn}
        title="Reply all"
        aria-label="Reply all"
        onClick={() => props.onReplyAll(props.emailMessage)}
      >
        <ReplyAllIcon className={styles.icon} aria-hidden />
      </button>

      <button
        type="button"
        className={styles.iconBtn}
        title="Forward"
        aria-label="Forward"
        onClick={() => props.onForward(props.emailMessage)}
      >
        <ForwardIcon className={styles.icon} aria-hidden />
      </button>

      <span className={styles.spacer} />

      <button
        type="button"
        className={styles.iconBtn}
        title="Move"
        aria-label="Move"
        onClick={() => props.onToggleMove(props.emailMessage.ref)}
      >
        <FolderIcon className={styles.icon} aria-hidden />
      </button>
    </div>
  );
}
