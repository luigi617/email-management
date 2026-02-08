import ArchiveIcon from "@/assets/svg/box-archive.svg?react";
import DeleteIcon from "@/assets/svg/delete.svg?react";
import ReplyIcon from "@/assets/svg/reply.svg?react";
import ReplyAllIcon from "@/assets/svg/reply-all.svg?react";
import ForwardIcon from "@/assets/svg/forward.svg?react";
import FolderIcon from "@/assets/svg/folder.svg?react";
import styles from "@/styles/DetailToolbar.module.css";

export type DetailToolbarProps = {
  onArchive: () => void;
  onDelete: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onToggleMove: () => void;
};

export default function DetailToolbar(props: DetailToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={styles.iconBtn}
        title="Archive"
        aria-label="Archive"
        onClick={props.onArchive}
      >
        <ArchiveIcon className={styles.icon} aria-hidden />
      </button>

      <button
        type="button"
        className={styles.iconBtn}
        title="Delete"
        aria-label="Delete"
        onClick={props.onDelete}
      >
        <DeleteIcon className={styles.icon} aria-hidden />
      </button>

      <span className={styles.separator} />

      <button
        type="button"
        className={styles.iconBtn}
        title="Reply"
        aria-label="Reply"
        onClick={props.onReply}
      >
        <ReplyIcon className={styles.icon} aria-hidden />
      </button>

      <button
        type="button"
        className={styles.iconBtn}
        title="Reply all"
        aria-label="Reply all"
        onClick={props.onReplyAll}
      >
        <ReplyAllIcon className={styles.icon} aria-hidden />
      </button>

      <button
        type="button"
        className={styles.iconBtn}
        title="Forward"
        aria-label="Forward"
        onClick={props.onForward}
      >
        <ForwardIcon className={styles.icon} aria-hidden />
      </button>

      <span className={styles.spacer} />

      <button
        type="button"
        className={styles.iconBtn}
        title="Move"
        aria-label="Move"
        onClick={props.onToggleMove}
      >
        <FolderIcon className={styles.icon} aria-hidden />
      </button>
    </div>
  );
}
