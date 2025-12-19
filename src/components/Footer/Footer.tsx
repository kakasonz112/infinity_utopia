import React from "react";
import styles from "./Footer.module.css";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footerBar}>
      <div>© {year} INFINITY KINGDOM. All rights reserved.</div>
      <div>Created by KAKA</div>
      <div className={styles.footerSmall}>
        This project is a fan-made tool and is not affiliated with MUGA. UTOPIA game
        content and trademarks are the property of MUGA.
      </div>
    </footer>
  );
}
