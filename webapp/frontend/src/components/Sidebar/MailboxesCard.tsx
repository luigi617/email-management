// src/components/Sidebar/MailboxesCard.tsx
import MailboxTree from "./MailboxTree";
import type { MailboxData } from "../../types/email";
import styles from "@/styles/MailboxesCard.module.css";

export type MailboxesCardProps = {
  mailboxData: MailboxData;
  currentMailbox: string;
  filterAccounts: string[];
  onSelectAllInboxes: () => void;
  onSelectMailbox: (account: string, mailbox: string) => void;

  onManageAccounts: () => void; // NEW
};

export default function MailboxesCard(props: MailboxesCardProps) {
  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Mailboxes</h2>

        <button type="button" className={styles.accountsButton} onClick={props.onManageAccounts}>
          Accounts
        </button>
      </div>

      <MailboxTree {...props} />
    </section>
  );
}
