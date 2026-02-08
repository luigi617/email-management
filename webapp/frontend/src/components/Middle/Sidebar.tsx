// src/components/Layout/Sidebar.tsx
import SearchCard from '../Sidebar/SearchCard';
import MailboxesCard from '../Sidebar/MailboxesCard';
import LegendCard from '../Sidebar/LegendCard';
import type { MailboxData } from '../../types/email';
import '../../styles/sidebar.css'

export type SidebarProps = {

  mailboxData: MailboxData;
  currentMailbox: string;
  filterAccounts: string[];
  onSelectAllInboxes: () => void;
  onSelectMailbox: (account: string, mailbox: string) => void;

  legendAccounts: string[];
  legendColorMap: Record<string, string>;
  onToggleLegendAccount: (account: string) => void;

  onManageAccounts: () => void;
};

export default function Sidebar(props: SidebarProps) {
  return (
    <>

      <MailboxesCard
        mailboxData={props.mailboxData}
        currentMailbox={props.currentMailbox}
        filterAccounts={props.filterAccounts}
        onSelectAllInboxes={props.onSelectAllInboxes}
        onSelectMailbox={props.onSelectMailbox}
        onManageAccounts={props.onManageAccounts}
      />

      <LegendCard
        accounts={props.legendAccounts}
        colorMap={props.legendColorMap}
        activeAccounts={props.filterAccounts}
        onToggleAccount={props.onToggleLegendAccount}
      />
    </>
  );
}
