import React from "react";

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
    <div className="detail-toolbar">
      <button type="button" className="icon-btn" title="Archive" aria-label="Archive" onClick={props.onArchive}>
        <img src="/static/svg/box-archive.svg" alt="" aria-hidden="true" className="icon-img" />
      </button>

      <button type="button" className="icon-btn" title="Delete" aria-label="Delete" onClick={props.onDelete}>
        <img src="/static/svg/delete.svg" alt="" aria-hidden="true" className="icon-img" />
      </button>

      <span className="toolbar-separator" />

      <button type="button" className="icon-btn" title="Reply" aria-label="Reply" onClick={props.onReply}>
        <img src="/static/svg/reply.svg" alt="" aria-hidden="true" className="icon-img" />
      </button>

      <button type="button" className="icon-btn" title="Reply all" aria-label="Reply all" onClick={props.onReplyAll}>
        <img src="/static/svg/reply-all.svg" alt="" aria-hidden="true" className="icon-img" />
      </button>

      <button type="button" className="icon-btn" title="Forward" aria-label="Forward" onClick={props.onForward}>
        <img src="/static/svg/forward.svg" alt="" aria-hidden="true" className="icon-img" />
      </button>

      <span className="toolbar-spacer" />

      <button type="button" className="icon-btn" title="Move" aria-label="Move" onClick={props.onToggleMove}>
        <img src="/static/svg/folder.svg" alt="" aria-hidden="true" className="icon-img" />
      </button>
    </div>
  );
}
