import { useState } from "react";
import Sidebar, { type SidebarProps } from "./Sidebar";
import MiddleColumn, { type MiddleColumnProps } from "./MiddleColumn";
import DetailColumn, { type DetailColumnProps } from "./DetailColumn";
import styles from "@/styles/Layout.module.css";

export default function Layout(props: {
  sidebar: SidebarProps;
  middle: MiddleColumnProps;
  detail: DetailColumnProps;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [mobileView, setMobileView] = useState<"middle" | "detail">(
    "middle"
  );

  return (
    <main
      className={styles.layout}
      data-mobile-view={mobileView}
      data-sidebar-open={sidebarOpen ? "true" : "false"}
    >
      {/* Backdrop (mobile only, shown when sidebar open) */}
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close sidebar"
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={styles.sidebar}>
        <Sidebar
          {...props.sidebar}
          onSelectAllInboxes={() => {
            props.sidebar.onSelectAllInboxes();
            setSidebarOpen(false);
          }}
          onSelectMailbox={(account, mailbox) => {
            props.sidebar.onSelectMailbox(account, mailbox);
            setSidebarOpen(false);
          }}
          onToggleLegendAccount={(account) => {
            props.sidebar.onToggleLegendAccount(account);
          }}
          onCompose={() => {
            props.sidebar.onCompose();
            setSidebarOpen(false);
          }}
        />
      </aside>

      <section className={styles.middle}>
        <MiddleColumn
          {...props.middle}
          onOpenSidebar={() => setSidebarOpen(true)}
          onSelectEmail={(email) => {
            props.middle.onSelectEmail(email);
            setMobileView("detail");
            setSidebarOpen(false);
          }}
        />
      </section>

      <section className={styles.detail}>
        <DetailColumn
          {...props.detail}
          onBack={() => {
            setMobileView("middle");
          }}
        />
      </section>
    </main>
  );
}
