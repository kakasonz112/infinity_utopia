"use client";

// pages/index.js (or app/page.js if using the app router)
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';

const tools = [
  { href: '/kingdoms', icon: 'K', title: 'View Kingdoms', desc: 'Browse kingdom stats and summaries' },
  { href: '/counter', icon: 'C', title: 'Target Counter', desc: 'Adjust target counts quickly' },
  { href: '/target', icon: 'T', title: 'Target Assign', desc: 'Assign and review targets' },
  { href: '/parser', icon: 'W', title: 'War Target Assign', desc: 'Run war planning utilities' },
  { href: '/CFPlanner', icon: 'F', title: 'CF Planner', desc: 'Ceasefire planning tools' },
  { href: '/formatter', icon: 'U', title: 'Utopia CE Formatter', desc: 'Paste kingdom news and get reports' },
];

export default function Home() {
  const goBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  return (
    <main className={styles.pageContainer}>
      <header className={styles.header}>
        <span className={styles.headerBadge}>v2.1</span>
      </header>

      <div className={styles.blobs} aria-hidden="true">
        <span className={`${styles.blob} ${styles.a}`} />
        <span className={`${styles.blob} ${styles.b}`} />
        <span className={`${styles.blob} ${styles.c}`} />
      </div>

      <div className={styles.contentWrap}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroContent}>
              <div className={styles.titleBlock}>
                <div className={styles.logoWrap}>
                  <Image src="/infinity.png" alt="Infinity logo" width={140} height={44} priority />
                </div>
                <h1 className={styles.title}>Infinity Kingdom Index</h1>
                <p className={styles.subtitle}>Everything you need to monitor provinces, plan wars, and share intel.</p>
                <div className={styles.ctaRow}>
                </div>
              </div>
            </div>
            <div className={styles.mascotWrap}>
              <Image src="/infinity.png" alt="mascot" width={180} height={180} priority />
            </div>
          </div>
        </section>

        <section className={styles.grid}>
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className={styles.card}>
              <div className={styles.cardIcon}>{tool.icon}</div>
              <div className={styles.cardText}>
                <div className={styles.cardTitle}>{tool.title}</div>
                <div className={styles.cardDesc}>{tool.desc}</div>
              </div>
            </Link>
          ))}
        </section>

        <p className={styles.footerNote}>Tip: Use the Formatter for instant, Discord-ready war reports.</p>
      </div>

      <footer className={styles.footerBar}>
        <div>© 2025 INFINITY KINGDOM. All rights reserved.</div>
        <div>Created by KAKA</div>
        <div className={styles.footerSmall}>This project is a fan-made tool and is not affiliated with MUGA. UTOPIA game content and trademarks are the property of MUGA.</div>
      </footer>
    </main>
  );
}