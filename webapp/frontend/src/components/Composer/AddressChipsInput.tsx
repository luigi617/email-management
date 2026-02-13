// src/components/Composer/AddressChipsInput.tsx
import { useRef, useState } from 'react';
import styles from '@/styles/AddressChipsInput.module.css';

type Props = {
  fieldId: string; // used for id attribute (composer-to, etc.)
  placeholder?: string;
  value: string[]; // chips
  onChange: (next: string[]) => void;
  className?: string; // optional extra class for the <input>
};

function splitAddresses(raw: string): string[] {
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function AddressChipsInput({ fieldId, placeholder, value, onChange, className }: Props) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  function commit() {
    const parts = splitAddresses(draft);
    if (!parts.length) return;
    onChange([...value, ...parts]);
    setDraft('');
  }

  function removeAt(idx: number) {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  }

  return (
    <div className={styles.wrapper} data-field={fieldId.replace('composer-', '')}>
      <div className={styles.pills}>
        {value.map((addr, idx) => (
          <span
            key={`${addr}-${idx}`}
            className={styles.pill}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.preventDefault()}
          >
            <span className={styles.pillText}>{addr}</span>
            <button
              type="button"
              className={styles.pillRemove}
              title="Remove"
              onClick={() => removeAt(idx)}
            >
              x
            </button>
          </span>
        ))}
      </div>

      <input
        ref={inputRef}
        id={fieldId}
        type="text"
        className={[styles.input, className].filter(Boolean).join(' ')}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ';' || e.key === ',') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !draft) {
            if (value.length) onChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}
