// src/components/Sidebar/MailboxTree.tsx
import { useMemo, useState } from 'react';
import type { MailboxData } from '../../types/email';
import { getMailboxDisplayName } from '../../utils/emailFormat';
import styles from '@/styles/MailboxTree.module.css';

export type MailboxTreeProps = {
  mailboxData: MailboxData;
  currentMailbox: string;
  filterAccounts: string[];
  onSelectAllInboxes: () => void;
  onSelectMailbox: (account: string, mailbox: string) => void;
};

export default function MailboxTree(props: MailboxTreeProps) {
  const { mailboxData, currentMailbox, filterAccounts, onSelectAllInboxes, onSelectMailbox } =
    props;

  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>({});

  const entries = useMemo(() => Object.entries(mailboxData || {}), [mailboxData]);
  const activeAccounts = useMemo(() => new Set(filterAccounts || []), [filterAccounts]);

  const allInboxesUnseen = useMemo(() => {
    const data = mailboxData || {};
    const accounts = Object.keys(data);

    return accounts.reduce((sum, account) => {
      const mailboxesObj = data[account] || {};
      const inboxStatus = mailboxesObj['INBOX'];
      const unseen = Number(inboxStatus?.unseen ?? 0);
      return sum + unseen;
    }, 0);
  }, [mailboxData]);

  const allInboxesIsActive = !activeAccounts.size && currentMailbox === 'INBOX';

  return (
    <div id="mailbox-list" className={styles.mailboxList}>
      {/* All inboxes */}
      <div className={styles.mailboxGroup}>
        <div
          className={[
            styles.mailboxItem,
            styles.mailboxItemAll,
            allInboxesIsActive ? styles.active : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-mailbox="INBOX"
          data-account=""
          onClick={onSelectAllInboxes}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelectAllInboxes();
          }}
        >
          <span className={styles.mailboxDot} />
          <span className={styles.mailboxName}>All inboxes</span>

          {allInboxesUnseen > 0 ? (
            <span className={styles.mailboxBadge} aria-label={`${allInboxesUnseen} unread`}>
              {allInboxesUnseen}
            </span>
          ) : null}
        </div>
      </div>

      {!entries.length ? (
        <div className={styles.empty}>No mailboxes available.</div>
      ) : (
        entries.map(([account, mailboxesObj]) => {
          const isCollapsed = !!collapsedAccounts[account];

          const mailboxItems = Object.entries(mailboxesObj || {})
            .map(([name, status]) => ({
              name,
              unseen: Number(status?.unseen ?? 0),
              messages: Number(status?.messages ?? 0),
            }))
            .sort((a, b) => {
              if (a.name === 'INBOX' && b.name !== 'INBOX') return -1;
              if (b.name === 'INBOX' && a.name !== 'INBOX') return 1;
              return a.name.localeCompare(b.name);
            });

          return (
            <div key={account} className={styles.mailboxGroup}>
              <button
                type="button"
                className={[styles.mailboxAccount, isCollapsed ? styles.collapsed : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setCollapsedAccounts((s) => ({ ...s, [account]: !s[account] }))}
              >
                <span className={styles.mailboxAccountChev}>▾</span>
                <span className={styles.mailboxAccountName}>{account}</span>
              </button>

              <div
                className={[styles.mailboxGroupItems, isCollapsed ? styles.itemsCollapsed : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {mailboxItems.map(({ name, unseen }) => {
                  const isActive =
                    name === currentMailbox &&
                    activeAccounts.size > 0 &&
                    activeAccounts.has(account);

                  return (
                    <div
                      key={`${account}:${name}`}
                      className={[styles.mailboxItem, isActive ? styles.active : '']
                        .filter(Boolean)
                        .join(' ')}
                      data-mailbox={name}
                      data-account={account}
                      onClick={() => onSelectMailbox(account, name)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onSelectMailbox(account, name);
                      }}
                    >
                      <span className={styles.mailboxDot} />
                      <span className={styles.mailboxName}>{getMailboxDisplayName(name)}</span>

                      {unseen > 0 ? (
                        <span className={styles.mailboxBadge} aria-label={`${unseen} unread`}>
                          {unseen}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
