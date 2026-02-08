import { Link } from "react-router-dom";
import styles from "@/styles/SidebarHome.module.css";
import SettingsIcon from "@/assets/svg/settings.svg?react";

export default function SidebarHome() {
  return (
    <div className={styles.sidebar}>
      <Link to="/" className={styles.logo}>
        OpenMail
      </Link>

      <Link to="/settings" className={styles.settingsButton}>
        <SettingsIcon className={styles.icon}/>
      </Link>
    </div>
  );
}
