import SearchCard from "./SearchCard";
import styles from '@/styles/EmailsHeader.module.css';

export type EmailsHeaderProps = {
  totalEmails: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  searchQuery: string;
  onSearch: (v: string) => void;
};

export default function EmailsHeader(props: EmailsHeaderProps) {
  const { totalEmails, searchQuery, onSearch } = props;

  const showCount = Number.isFinite(totalEmails) && totalEmails > 0;

  return (
    <section className={styles.listHeader}>
      <div className={styles.listHeaderTop}>
        <h2 className={styles.title}>Emails</h2>

        <div className={styles.listHeaderRight}>

          {showCount ? (
            <span className={styles.listCount}>{totalEmails.toLocaleString()} total</span>
          ) : null}
        </div>
      </div>

      <SearchCard searchQuery={searchQuery} onSearch={onSearch} />
    </section>
  );
}
