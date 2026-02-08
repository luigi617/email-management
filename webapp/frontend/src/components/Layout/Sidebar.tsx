// src/components/Layout/Sidebar.tsx
import MailboxesCard from "../Sidebar/MailboxesCard";
import LegendCard from "../Sidebar/LegendCard";
import type { MailboxData } from "../../types/email";
import styles from "@/styles/Sidebar.module.css";
import SidebarHome from "../Sidebar/SidebarHome";

export type SidebarProps = {
  mailboxData: MailboxData;
  currentMailbox: string;
  filterAccounts: string[];
  onSelectAllInboxes: () => void;
  onSelectMailbox: (account: string, mailbox: string) => void;

  legendAccounts: string[];
  legendColorMap: Record<string, string>;
  onToggleLegendAccount: (account: string) => void;
};

export default function Sidebar(props: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <SidebarHome />

      <MailboxesCard
        mailboxData={props.mailboxData}
        currentMailbox={props.currentMailbox}
        filterAccounts={props.filterAccounts}
        onSelectAllInboxes={props.onSelectAllInboxes}
        onSelectMailbox={props.onSelectMailbox}
      />

      <LegendCard
        accounts={props.legendAccounts}
        colorMap={props.legendColorMap}
        activeAccounts={props.filterAccounts}
        onToggleAccount={props.onToggleLegendAccount}
      />
    </aside>
  );
}
