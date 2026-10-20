import type { Metadata } from "next";
import type { ReactNode } from "react";
import changes from "./changes.json";
import styles from "./page.module.css";
import { Tabs } from "./Tabs";

export const metadata: Metadata = {
  title: "Age 117 Prefinal Changes",
  description: "Age 117 prefinal changes: races, personalities, dragons, rituals, and the revised changelog.",
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "races", label: "Races" },
  { id: "personalities", label: "Personalities" },
  { id: "dragons", label: "Dragons" },
  { id: "rituals", label: "Rituals" },
  { id: "changelog", label: "Changelog" },
];

function List({ items }: { items: string[] }) {
  return <ul className={styles.list}>{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.section}>
    <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>{title}</h2></div>
    <div className={styles.sectionBody}>{children}</div>
  </section>;
}

function Card({ name, subtitle, children }: { name: string; subtitle?: string; children: ReactNode }) {
  return <article className={styles.card}>
    <div className={styles.cardHead}><div>
      <h3 className={styles.cardTitle}>{name}</h3>
      {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
    </div></div>
    <div className={styles.cardBody}>{children}</div>
  </article>;
}

const panels: Record<string, ReactNode> = {
  overview: <>
    <Section title="Age 117 Prefinal Changes">
      <p>Based on the supplied UTOPIA AGE 117 PREFINAL CHANGES document. These changes are prefinal and may be revised.</p>
      <p><a href="/age-117-prefinal-changes.pdf" target="_blank" rel="noopener noreferrer">View source PDF</a>{" · "}
        <a href="/age-117-prefinal-changes.pdf" download>Download PDF</a></p>
    </Section>
    <Section title="General Changes"><List items={changes.general} /></Section>
  </>,
  races: <Section title="Races">
    <p>All doctrines give double the listed per-province bonus for the first province, then scale by the listed amount up to the maximum.</p>
    <div className={styles.cardGrid}>{changes.races.map((race) =>
      <Card key={race.name} name={race.name} subtitle={race.archetype}>
        <p className={styles.cardLabel}>War Doctrine</p><p className={styles.cardText}>{race.doctrine}</p>
        <p className={styles.cardLabel}>{race.ability}</p><p className={styles.cardText}>{race.effect}</p>
        <p className={styles.cardLabel}>Bonuses</p><List items={race.bonuses} />
        <p className={styles.cardLabel}>Penalties</p><p className={styles.cardText}>{race.penalties}</p>
        <p className={styles.cardLabel}>Unique Spells</p>
        <div className={styles.pillList}>{race.spells.split(", ").map((spell) => <span className={styles.pill} key={spell}>{spell}</span>)}</div>
        <p className={styles.cardLabel}>Units</p><List items={race.units} />
      </Card>
    )}</div>
  </Section>,
  personalities: <Section title="Personalities">
    <div className={styles.cardGrid}>{changes.personalities.map((personality) =>
      <Card key={personality.name} name={personality.name} subtitle={personality.archetype}>
        <p className={styles.cardLabel}>{personality.ability}</p><p className={styles.cardText}>{personality.effect}</p>
        <p className={styles.cardLabel}>Bonuses</p><List items={personality.bonuses} />
        <p className={styles.cardLabel}>Unique Spells</p>
        <div className={styles.pillList}>{personality.spells.map((spell) => <span className={styles.pill} key={spell}>{spell}</span>)}</div>
        <p className={styles.cardLabel}>Starting Units / Credits</p><List items={personality.starting} />
      </Card>
    )}</div>
  </Section>,
  dragons: <Section title="Dragons">
    <p>Dragon hitpoints are reduced by 10%. Recurring effects after 6 ticks have been removed.</p>
    <div className={styles.cardGrid}>{changes.dragons.map((dragon) =>
      <Card key={dragon.name} name={dragon.name} subtitle="Dragon"><p className={styles.cardText}>{dragon.effect}</p></Card>
    )}</div>
  </Section>,
  rituals: <Section title="Rituals">
    <p>Ascendancy has been removed.</p>
    <div className={styles.cardGrid}>{changes.rituals.map((ritual) =>
      <Card key={ritual.name} name={ritual.name} subtitle="Ritual"><p className={styles.cardText}>{ritual.effect}</p></Card>
    )}</div>
  </Section>,
  changelog: <>
    <Section title="Change Log from Revised"><List items={changes.changelog} /></Section>
    <Section title="Unique Ability Programming Changes from Existing"><List items={changes.abilities} /></Section>
  </>,
};

export default function FinalChanges117Page() {
  return <main className={styles.page}><div className={styles.container}>
    <div className={styles.headerRow}>
      <h1 className={styles.title}>Age 117 Changes</h1>
      <span className={styles.badge}>Prefinal</span>
    </div>
    <div className={styles.divider} />
    <div className={styles.content}><Tabs tabs={tabs} panels={panels} /></div>
  </div></main>;
}
