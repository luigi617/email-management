// src/components/Layout/Layout.tsx
import Sidebar, { type SidebarProps } from "./Sidebar";
import MiddleColumn, { type MiddleColumnProps } from "./MiddleColumn";
import DetailColumn, { type DetailColumnProps } from "./DetailColumn";
import styles from "@/styles/Layout.module.css";

export default function Layout(props: {
  sidebar: SidebarProps;
  middle: MiddleColumnProps;
  detail: DetailColumnProps;
}) {
  return (
    <main className={styles.layout}>
      <aside className={styles.sidebar}>
        <Sidebar {...props.sidebar} />
      </aside>

      <section className={styles.middle}>
        <MiddleColumn {...props.middle} />
      </section>

      <section className={styles.detail}>
        <DetailColumn {...props.detail} />
      </section>
    </main>
  );
}
