import { getMailboxDisplayName } from "../../utils/emailFormat";
import SearchCard from "./SearchCard";
import styles from '@/styles/EmailsHeader.module.css';

export type EmailsHeaderProps = {
  accounts: string[];
  mailbox: string;
  totalEmails: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  searchQuery: string;
  onSearch: (v: string) => void;
  onOpenSidebar: () => void;
};

function getAccountMailboxName(accounts: string[], mailbox: string) {
  if (accounts.length == 0) {
    return "All inboxes"
  }
  return accounts[0] + " • " + getMailboxDisplayName(mailbox)

}


export default function EmailsHeader(props: EmailsHeaderProps) {
  const { searchQuery, onSearch } = props;

  return (
    <section className={styles.listHeader}>
      <div className={styles.listHeaderTop}>
        <div className={styles.mobileTopBar}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={props.onOpenSidebar}
            aria-label="Open sidebar"
          >
            ☰
          </button>
        </div>
        <h2 className={styles.title}>{getAccountMailboxName(props.accounts, props.mailbox)}</h2>


      </div>

      <SearchCard searchQuery={searchQuery} onSearch={onSearch} />
    </section>
  );
}
