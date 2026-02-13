// src/components/Composer/ComposerEditor.tsx
import { useEffect, useRef } from 'react';
import styles from '@/styles/ComposerEditor.module.css';

export type ComposerEditorProps = {
  value: string;
  onChange: (html: string) => void;
};

function isMac() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function normalizePlainTextToHtml(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return escaped.replace(/\r\n|\r|\n/g, '<br>');
}

function insertHtmlAtSelection(html: string) {
  try {
    if (document.queryCommandSupported?.('insertHTML')) {
      const ok = document.execCommand('insertHTML', false, html);
      if (ok) return;
    }
  } catch {
    // ignore and fall back
  }

  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  range.deleteContents();

  const temp = document.createElement('div');
  temp.innerHTML = html;

  const frag = document.createDocumentFragment();
  let node: ChildNode | null;

  while ((node = temp.firstChild)) frag.appendChild(node);

  const lastNode = frag.lastChild;
  range.insertNode(frag);

  if (lastNode) {
    const newRange = document.createRange();
    newRange.setStartAfter(lastNode);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}

function sanitizePastedHtml(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const blocked = doc.querySelectorAll(
    'script, iframe, object, embed, link, meta, style, form, input, button, textarea, select'
  );
  blocked.forEach((n) => n.remove());

  const allowedStyleProps = new Set([
    'font-weight',
    'font-style',
    'text-decoration',
    'color',
    'background-color',
    'font-size',
    'font-family',
    'text-align',
    'white-space',
  ]);

  const walk = (node: Element) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith('on')) {
        node.removeAttribute(attr.name);
        continue;
      }

      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
        node.removeAttribute(attr.name);
        continue;
      }

      if (name === 'style') {
        const kept: string[] = [];
        value.split(';').forEach((decl) => {
          const [rawProp, ...rest] = decl.split(':');
          if (!rawProp || rest.length === 0) return;
          const prop = rawProp.trim().toLowerCase();
          const val = rest.join(':').trim();
          if (!prop) return;

          if (allowedStyleProps.has(prop)) kept.push(`${prop}: ${val}`);
        });

        if (kept.length) node.setAttribute('style', kept.join('; '));
        else node.removeAttribute('style');
        continue;
      }

      if (name === 'class' || name === 'id') {
        node.removeAttribute(attr.name);
      }
    }

    for (const child of Array.from(node.children)) walk(child);
  };

  for (const el of Array.from(doc.body.children)) walk(el);

  return doc.body.innerHTML;
}

export default function ComposerEditor({ value, onChange }: ComposerEditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const isFocusedRef = useRef(false);
  const lastEmittedHtmlRef = useRef<string>(value);
  const plainPasteNextRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (value === lastEmittedHtmlRef.current) return;
    if (isFocusedRef.current) return;

    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  const emitChange = () => {
    const html = ref.current?.innerHTML ?? '';
    lastEmittedHtmlRef.current = html;
    onChange(html);
  };

  return (
    <div className={styles.editor}>
      <div
        ref={ref}
        id="composer-body"
        className={styles.body}
        contentEditable
        role="textbox"
        aria-multiline="true"
        spellCheck
        suppressContentEditableWarning
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          emitChange();
        }}
        onInput={() => {
          emitChange();
        }}
        onKeyDown={(e) => {
          const mod = isMac() ? e.metaKey : e.ctrlKey;

          if (mod && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
            plainPasteNextRef.current = true;

            const canRead =
              typeof navigator !== 'undefined' &&
              'clipboard' in navigator &&
              'readText' in navigator.clipboard;

            if (canRead) {
              e.preventDefault();
              navigator.clipboard
                .readText()
                .then((t) => {
                  insertHtmlAtSelection(normalizePlainTextToHtml(t));
                  emitChange();
                })
                .catch(() => {
                  // fallback to onPaste with the flag
                });
            }
          }
        }}
        onPaste={(e) => {
          const dt = e.clipboardData;
          if (!dt) return;

          const html = dt.getData('text/html');
          const text = dt.getData('text/plain');

          e.preventDefault();

          const forcePlain = plainPasteNextRef.current;
          plainPasteNextRef.current = false;

          if (forcePlain || !html) {
            insertHtmlAtSelection(normalizePlainTextToHtml(text));
            emitChange();
            return;
          }

          const cleaned = sanitizePastedHtml(html);
          insertHtmlAtSelection(cleaned);
          emitChange();
        }}
      />
    </div>
  );
}
