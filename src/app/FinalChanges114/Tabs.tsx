"use client";

import { useState, type ReactNode } from "react";
import styles from "./page.module.css";

type Tab = {
  id: string;
  label: string;
};

type TabsProps = {
  tabs: Tab[];
  panels: Record<string, ReactNode>;
};

export function Tabs({ tabs, panels }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");

  return (
    <div className={styles.tabWrapper}>
      <div className={styles.tabBar} role="tablist" aria-label="Final Changes sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeId === tab.id}
            aria-controls={`${tab.id}-panel`}
            id={`${tab.id}-tab`}
            className={activeId === tab.id ? `${styles.tabButton} ${styles.tabButtonActive}` : styles.tabButton}
            onClick={() => setActiveId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const content = panels[tab.id] ?? null;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${tab.id}-panel`}
            aria-labelledby={`${tab.id}-tab`}
            hidden={!isActive}
            className={styles.tabPanel}
          >
            {isActive ? content : null}
          </div>
        );
      })}
    </div>
  );
}
