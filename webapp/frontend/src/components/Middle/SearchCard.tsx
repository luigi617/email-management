import CloseIcon from '@/assets/svg/close.svg?react';
import { useState } from 'react';
import styles from '@/styles/SearchCard.module.css';

type Props = {
  searchQuery: string;
  onSearch: (v: string) => void;
};

export default function SearchCard(props: Props) {
  const [value, setValue] = useState(props.searchQuery);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);

    // If cleared via typing, immediately search empty
    if (next.trim() === '') {
      props.onSearch('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      props.onSearch(value);
    }
  };

  const handleClear = () => {
    setValue('');
    props.onSearch('');
  };

  return (
    <section className={styles.card}>
      <div className={styles.searchRow}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search mail"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

        <button
          type="button"
          className={styles.clearBtn}
          aria-label="Clear"
          onClick={handleClear}
        >
          <CloseIcon className={styles.icon} aria-hidden />
        </button>
      </div>
    </section>
  );
}
