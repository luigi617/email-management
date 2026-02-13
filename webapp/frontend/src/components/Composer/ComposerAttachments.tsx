// src/components/Composer/ComposerAttachments.tsx
import CloseIcon from '@/assets/svg/close.svg?react';
import styles from '@/styles/ComposerAttachments.module.css';

export type ComposerAttachmentsProps = {
  files: File[];
  visible: boolean;
  onRemove: (idx: number) => void;
  onPreview: (file: File) => void;
};

export default function ComposerAttachments(props: ComposerAttachmentsProps) {
  return (
    <div className={`${styles.attachments} ${props.visible ? '' : styles.hidden}`}>
      {props.files.map((f, idx) => (
        <div key={`${f.name}-${idx}`} className={styles.pill} role="group">
          <button
            type="button"
            className={styles.pillMain}
            onClick={() => props.onPreview(f)}
            title="Preview attachment"
          >
            {f.name}
          </button>

          <button
            type="button"
            className={styles.pillRemove}
            title="Remove attachment"
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove(idx);
            }}
          >
            <CloseIcon className={styles.icon} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
