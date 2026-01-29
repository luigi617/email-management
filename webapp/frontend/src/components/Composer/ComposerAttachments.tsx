// src/components/Composer/ComposerAttachments.tsx
import React from "react";

export type ComposerAttachmentsProps = {
  files: File[];
  visible: boolean;
  onRemove: (idx: number) => void;
};

export default function ComposerAttachments(props: ComposerAttachmentsProps) {
  return (
    <div className={`composer-attachments ${props.visible ? "" : "hidden"}`}>
      {props.files.map((f, idx) => (
        <button
          key={`${f.name}-${idx}`}
          type="button"
          className="attachment-pill"
          onClick={() => props.onRemove(idx)}
          title="Remove attachment"
        >
          {f.name} ✕
        </button>
      ))}
    </div>
  );
}
