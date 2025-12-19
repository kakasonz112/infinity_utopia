"use client";

// pages/index.js (or app/page.js if using the app router)
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';

const tools = [
  { href: '/kingdoms', icon: 'View', title: 'View Kingdoms', desc: 'Overview of all kingdoms taken from kingdom_dump_v2 with CF tracker but its +1/-1 tick off due to the dump api not updated on time.' },
  { href: '/counter', icon: 'C', title: 'Target Counter', desc: 'A counter to count how much the province has been hit' },
  { href: '/target', icon: 'A', title: 'Target Assign', desc: 'Basically to assign target base on best gain ratio to everyone. Just ctrl-a on kingdom page n paste into the input field' },
  { href: '/parser', icon: 'War', title: 'War Target Assign', desc: 'To assign multiple specific target and assign to attackers to hit' },
  { href: '/CFPlanner', icon: 'CF', title: 'CF Planner', desc: ' Generate EOWCF schedule' },
  { href: '/formatter', icon: 'CE', title: 'Utopia CE Formatter', desc: ' Generate war summary like Seraphim(dead)' },
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

        <p className={styles.footerNote}>Tip: Use the CE Formatter for formatted summarize report.</p>
      </div>
    </main>
  );
}