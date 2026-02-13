// src/components/Composer/Composer.tsx
import { useRef } from "react";
import { AddressChipsInput } from "./AddressChipsInput";
import ComposerExtraMenu from "./ComposerExtraMenu";
import ComposerEditor from "./ComposerEditor";
import ComposerAttachments from "./ComposerAttachments";
import SendLaterMenu from "./SendLaterMenu";
import { useComposerResize } from "../../hooks/useComposerResize";
import type { ComposerExtraFieldKey } from "../../types/composer";
import type { Priority } from "../../types/shared";

import ListIcon from "@/assets/svg/composerList.svg?react";
import AttachmentIcon from "@/assets/svg/attachment.svg?react";
import EmojiIcon from "@/assets/svg/emoji.svg?react";
import MinimizeIcon from "@/assets/svg/minimize.svg?react";
import CloseIcon from "@/assets/svg/close.svg?react";

import styles from "@/styles/Composer.module.css";
import Button from "../ui/Button/Button";

export type ComposerProps = {
  open: boolean;
  onClose: () => void;

  title: string;
  minimized: boolean;

  extraMenuOpen: boolean;
  onToggleExtraMenu: () => void;

  extra: Record<ComposerExtraFieldKey, boolean>;
  onToggleExtraField: (k: ComposerExtraFieldKey) => void;

  to: string[];
  cc: string[];
  bcc: string[];
  onToChange: (v: string[]) => void;
  onCcChange: (v: string[]) => void;
  onBccChange: (v: string[]) => void;

  subject: string;
  onSubjectChange: (v: string) => void;

  replyToRaw: string;
  onReplyToRawChange: (v: string) => void;

  priority: Priority;
  onPriorityChange: (v: Priority) => void;

  fromAccount: string;
  accounts: string[];
  onFromChange: (v: string) => void;

  html: string;
  onHtmlChange: (v: string) => void;

  attachments: File[];
  onAddAttachments: (files: File[]) => void;
  onRemoveAttachmentAt: (idx: number) => void;

  error: string;
  onSend: () => void;

  onMinimizeToggle: () => void;

  sendLaterOpen: boolean;
  onToggleSendLater: () => void;
  onCloseSendLater: () => void;
  onSendLaterPick: (label: string, delayKey: string) => void;

  onCloseExtraMenu: () => void;
};

export default function Composer(props: ComposerProps) {
  const resizeEnabled = props.open && !props.minimized;
  const { composerRef, zoneRef } = useComposerResize(resizeEnabled);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      ref={composerRef}
      className={[
        styles.composer,
        props.open ? "" : styles.hidden,
        props.minimized ? styles.minimized : "",
      ].join(" ")}
    >
      {!props.minimized && <div ref={zoneRef} className={styles.resizeZone} />}

      {/* header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            id="composer-extra-toggle"
            className={`${styles.iconBtn} ${styles.iconBtnSecondary}`}
            title="Show fields"
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleExtraMenu();
            }}
          >
            <ListIcon className={styles.icon} aria-hidden />
          </button>

          <ComposerExtraMenu
            open={props.extraMenuOpen}
            onClose={props.onCloseExtraMenu}
            state={props.extra}
            onToggle={props.onToggleExtraField}
          />

          <button
            type="button"
            id="composer-attach"
            className={styles.iconBtn}
            title="Add attachment"
            onClick={() => fileInputRef.current?.click()}
          >
            <AttachmentIcon className={styles.icon} aria-hidden />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            className={styles.fileInput}
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) props.onAddAttachments(files);
              e.currentTarget.value = "";
            }}
          />

          <button type="button" id="composer-emoji" className={styles.iconBtn} title="Add emoji">
            <EmojiIcon className={styles.icon} aria-hidden />
          </button>

          <button type="button" id="composer-format" className={styles.iconBtn} title="Format text">
            Aa
          </button>

          <span id="composer-title" className={styles.titleHidden}>
            {props.title}
          </span>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            id="composer-minimize"
            className={styles.iconBtn}
            title="Minimize"
            onClick={props.onMinimizeToggle}
          >
            <MinimizeIcon className={styles.icon} aria-hidden />
          </button>

          <button
            type="button"
            id="composer-close"
            className={styles.headerLink}
            title="Close"
            aria-label="Close"
            onClick={props.onClose}
          >
            <CloseIcon className={styles.icon} aria-hidden />
          </button>
        </div>
      </div>

      {!props.minimized && (
        <div className={styles.main}>
          <div className={styles.meta}>
            <label className={styles.row}>
              <span className={styles.label}>To:</span>
              <AddressChipsInput
                fieldId="composer-to"
                placeholder="Recipients (comma or semicolon separated)"
                value={props.to}
                onChange={props.onToChange}
              />
            </label>

            <label
              className={[
                styles.row,
                styles.rowExtra,
                props.extra.cc ? "" : styles.hidden,
              ].join(" ")}
              data-field="cc"
            >
              <span className={styles.label}>Cc:</span>
              <AddressChipsInput
                fieldId="composer-cc"
                placeholder="Cc"
                value={props.cc}
                onChange={props.onCcChange}
              />
            </label>

            <label
              className={[
                styles.row,
                styles.rowExtra,
                props.extra.bcc ? "" : styles.hidden,
              ].join(" ")}
              data-field="bcc"
            >
              <span className={styles.label}>Bcc:</span>
              <AddressChipsInput
                fieldId="composer-bcc"
                placeholder="Bcc"
                value={props.bcc}
                onChange={props.onBccChange}
              />
            </label>

            <label className={styles.row}>
              <span className={styles.label}>Subject:</span>
              <input
                type="text"
                id="composer-subject"
                className={styles.inlineInput}
                placeholder="Subject"
                value={props.subject}
                onChange={(e) => props.onSubjectChange(e.target.value)}
              />
            </label>

            <label
              className={[
                styles.row,
                styles.rowExtra,
                props.extra.replyto ? "" : styles.hidden,
              ].join(" ")}
              data-field="replyto"
            >
              <span className={styles.label}>Reply-To:</span>
              <input
                type="text"
                id="composer-replyto"
                className={styles.inlineInput}
                placeholder="Reply-To"
                value={props.replyToRaw}
                onChange={(e) => props.onReplyToRawChange(e.target.value)}
              />
            </label>

            <label
              className={[
                styles.row,
                styles.rowExtra,
                props.extra.priority ? "" : styles.hidden,
              ].join(" ")}
              data-field="priority"
            >
              <span className={styles.label}>Priority:</span>
              <select
                id="composer-priority"
                className={styles.inlineSelect}
                value={props.priority}
                onChange={(e) => props.onPriorityChange(e.target.value as Priority)}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label className={styles.row}>
              <span className={styles.label}>From:</span>
              <select
                id="composer-from"
                className={styles.inlineSelect}
                value={props.fromAccount}
                onChange={(e) => props.onFromChange(e.target.value)}
              >
                {!props.accounts.length && <option value="">(no accounts)</option>}
                {props.accounts.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ComposerEditor value={props.html} onChange={props.onHtmlChange} />

          <ComposerAttachments
            files={props.attachments}
            visible={props.attachments.length > 0}
            onRemove={props.onRemoveAttachmentAt}
            onPreview={(file) => {
              const url = URL.createObjectURL(file);
              window.open(url, "_blank", "noopener,noreferrer");
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
            }}
          />
        </div>
      )}

      {!props.minimized && (
        <div className={styles.footer}>
          <div className={`${styles.error} ${props.error ? "" : styles.hidden}`} id="composer-error">
            {props.error}
          </div>

          <Button type="button" id="composer-send" variant="primary" onClick={props.onSend}>
            Send
          </Button>

          <div className={styles.sendLaterWrapper}>
            <button
              type="button"
              id="composer-send-later-toggle"
              className={styles.secondaryBtn}
              onClick={(e) => {
                e.stopPropagation();
                props.onToggleSendLater();
              }}
            >
              Send later ▾
            </button>

            <SendLaterMenu
              open={props.sendLaterOpen}
              onClose={props.onCloseSendLater}
              onPick={props.onSendLaterPick}
            />
          </div>
        </div>
      )}
    </div>
  );
}
