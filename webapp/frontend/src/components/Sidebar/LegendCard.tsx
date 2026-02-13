// src/components/Sidebar/LegendCard.tsx
import { useMemo } from 'react';
import styles from '@/styles/LegendCard.module.css';

export type LegendCardProps = {
  accounts: string[];
  colorMap: Record<string, string>;
  activeAccounts: string[];
  onToggleAccount: (account: string) => void;
};

export default function LegendCard(props: LegendCardProps) {
  const active = useMemo(() => new Set(props.activeAccounts || []), [props.activeAccounts]);

  return (
    <section className={styles.legendBox}>
      <div className={styles.legendHeader}>
        <h2 className={styles.title}>Legend</h2>
      </div>

      <div id="legend-list" className={styles.legendList}>
        {props.accounts.map((account) => {
          const color = props.colorMap[account] || '#9ca3af';
          const isActive = active.has(account);

          return (
            <div
              key={account}
              className={[styles.legendItem, isActive ? styles.active : '']
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.legendColorDot} style={{ background: color }} />
              <span className={styles.legendText}>{account}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
