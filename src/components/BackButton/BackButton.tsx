"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import styles from "./BackButton.module.css";

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  // Don't show back button on the app root
  if (pathname === "/") return null;

  return (
    <button
      type="button"
      className={styles.backBtn}
      onClick={() => router.back()}
      aria-label="Go back"
    >
      ← Back
    </button>
  );
}
