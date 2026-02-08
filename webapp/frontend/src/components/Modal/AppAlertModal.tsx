import styles from "@/styles/AppAlertModal.module.css";

export type AppModalButton = {
  id: number;
  label: string;
  variant?: "primary" | "secondary";
  onClick: () => void;
};

export type AppModalState = {
  open: boolean;
  title: string;
  message: string;
  buttons?: AppModalButton[];
};

export default function AppAlertModal(props: {
  state: AppModalState;
  onClose: () => void;
}) {
  const { state } = props;

  const buttons =
    state.buttons?.length
      ? state.buttons
      : [{ id: 1, label: "OK", variant: "primary" as const, onClick: props.onClose }];

  return (
    <div
      className={`${styles.backdrop} ${state.open ? "" : styles.hidden}`}
      onMouseDown={props.onClose}
    >
      <div
        className={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{state.title}</h2>
        </div>

        <div className={styles.body}>
          <p>{state.message}</p>
        </div>

        <div className={styles.footer}>
          {buttons.map((b) => {
            const variantClass =
              b.variant === "primary"
                ? styles.primary
                : styles.secondary;

            return (
              <button
                key={b.id}
                type="button"
                className={`${styles.button} ${variantClass}`}
                onClick={b.onClick}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
