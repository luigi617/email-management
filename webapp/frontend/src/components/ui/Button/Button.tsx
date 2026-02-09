// Button.tsx
import React from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary: styles.primaryBtn,
  secondary: styles.secondaryBtn,
  ghost: styles.ghostBtn,
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}) => {
  return (
    <button
      className={[variantClassMap[variant], className].filter(Boolean).join(" ") }
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? "Loading..." : children}
    </button>
  );
};

export default Button;

