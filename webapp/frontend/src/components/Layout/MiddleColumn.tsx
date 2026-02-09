import { useEffect, useRef, useCallback } from "react";
import EmailsHeader from "../Middle/EmailsHeader";
import EmailList from "../Middle/EmailList";
import type { EmailOverview } from "../../types/email";
import styles from "@/styles/MiddleColumn.module.css";

export type MiddleColumnProps = {
  currentMailbox: string,
  currentAccounts: string[],

  searchQuery: string;
  onSearch: (v: string) => void;

  hasMore: boolean;
  isLoadingMore: boolean;
  totalEmails: number;

  onLoadMore: () => void;
  onCompose: () => void;

  emails: EmailOverview[];
  emptyList: boolean;
  selectedEmailId: string | null;
  onSelectEmail: (email: EmailOverview) => void;

  getEmailId: (email: EmailOverview) => string;
  getColorForEmail: (email: EmailOverview) => string;
};

export default function MiddleColumn(props: MiddleColumnProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { hasMore, isLoadingMore, emptyList, onLoadMore, emails } = props;

  const maybeLoadMore = useCallback(() => {
    if (!hasMore) return;
    if (isLoadingMore) return;
    if (emptyList) return;
    onLoadMore();
  }, [hasMore, isLoadingMore, emptyList, onLoadMore]);

  useEffect(() => {
    const rootEl = listRef.current;
    const target = sentinelRef.current;
    if (!rootEl || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          maybeLoadMore();
        }
      },
      {
        root: rootEl,
        threshold: 0,
        rootMargin: "200px",
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [maybeLoadMore, emails.length]);

  return (
    <div className={styles.middle}>
      <EmailsHeader
        accounts={props.currentAccounts}
        mailbox={props.currentMailbox}
        totalEmails={props.totalEmails}
        hasMore={props.hasMore}
        isLoadingMore={props.isLoadingMore}
        onLoadMore={props.onLoadMore}
        searchQuery={props.searchQuery}
        onSearch={props.onSearch}
      />

      <section className={styles.listContainer}>
        <EmailList
          emails={props.emails}
          selectedEmailId={props.selectedEmailId}
          getColorForEmail={props.getColorForEmail}
          getEmailId={props.getEmailId}
          onSelectEmail={props.onSelectEmail}
          listRef={listRef}
          sentinelRef={sentinelRef}
          showLoadingMore={props.isLoadingMore}
          showEnd={!props.hasMore && props.emails.length > 0}
          emptyList={props.emptyList}
        />
      </section>
    </div>
  );
}
