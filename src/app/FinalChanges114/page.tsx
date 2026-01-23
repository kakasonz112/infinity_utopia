import type { Metadata } from "next";
import type { ReactNode } from "react";
import styles from "./page.module.css";
import { Tabs } from "./Tabs";

export const metadata: Metadata = {
  title: "Final Changes - Age 114",
  description: "Read or download the Final Changes - Age 114 details with full inline text.",
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "races", label: "Races" },
  { id: "personalities", label: "Personalities" },
  { id: "dragons", label: "Dragons" },
  { id: "rituals", label: "Rituals" },
  { id: "changelog", label: "Changelog" },
];

const pdfSrc = "/final-changes-114.pdf";

type Race = {
  name: string;
  bonuses: string[];
  doctrine: string;
  unique: string;
  spells: string[];
  penalties: string[];
  units: string[];
};

type Personality = {
  name: string;
  bonuses: string[];
  starting: string[];
  unique: string;
};

type Dragon = {
  name: string;
  effects: string[];
  costModifier?: string;
};

type Ritual = {
  name: string;
  effects: string[];
};

const races: Race[] = [
  {
    name: "Avian",
    bonuses: ["-20% Attack Time", "-40% Training Time"],
    doctrine: "Provides up to -5% Attack Time to you and all your kingdom.",
    unique: "Opportunistic Raiders: Learn and Plunder attacks return armies 1 tick faster (after modifiers).",
    spells: ["Town Watch", "Illuminate Shadows", "Divine Shield", "Salvation"],
    penalties: ["Cannot Ambush", "No Access to Stables and War Horses"],
    units: [
      "Soldier: 3/0 (0.75nw)",
      "Offensive Specialist: 13/0 (5.2nw)",
      "Defensive Specialist: 0/9 (4.5nw)",
      "Elite Unit: 16/6 (900gc, 8nw)",
      "Mercenary: 8/0 (0.0nw)",
      "Prisoner: 8/0 (1.6nw)",
      "War Horse: n/a",
    ],
  },
  {
    name: "Dark Elf",
    bonuses: ["+25% Instant Spell Damage", "-50% Rune Cost (Not Including Rituals)", "Can train Thieves using Specialist Credits"],
    doctrine: "Provides up to +7.5% Instant Spell Damage to you and all your kingdom.",
    unique: "Mystic Enthusiasts: Successful offensive instant spells refund 20% rune cost.",
    spells: ["Blizzard", "Mage's Fury", "Illuminate Shadows", "Pitfalls", "Quick Feet"],
    penalties: ["-25% Birth Rates"],
    units: [
      "Soldier: 3/0 (0.75nw)",
      "Offensive Specialist: 15/0 (6nw)",
      "Defensive Specialist: 0/8 (4.0nw)",
      "Elite Unit: 4/12 (750gc, 7nw)",
      "Mercenary: 8/0 (0nw)",
      "Prisoner: 8/0 (1.6nw)",
      "War Horse: 2/0 (0.6nw)",
    ],
  },
  {
    name: "Dwarf",
    bonuses: ["+25% Building Efficiency", "-50% Construction Time", "+20% Building Credits in Combat"],
    doctrine: "Provides up to +7.5% Specialist Credits gained in combat to you and all your kingdom.",
    unique: "Incoming Raze damage reduced by 15% and Raze attacks destroy 20% additional buildings.",
    spells: ["Miner's Mystique", "Town Watch", "Reflect Magic", "Mist"],
    penalties: ["Cannot Accelerate Construction", "+10% Attack Time"],
    units: [
      "Soldier: 3/0 (0.75nw)",
      "Offensive Specialist: 10/0 (4.0nw)",
      "Defensive Specialist: 0/11 (6.0nw)",
      "Elite Unit: 15/9 (900gc, 8nw)",
      "Mercenary: 8/0 (0.0nw)",
      "Prisoner: 8/0 (1.6nw)",
      "War Horse: 2/0 (0.6nw)",
    ],
  },
  {
    name: "Elf",
    bonuses: ["+30% Magic Effectiveness (WPA)", "+1 Mana Per Tick in War"],
    doctrine: "Provides up to -7.5% Military Casualties Taken to you and all your kingdom.",
    unique: "Arcane Surge: When mana drops below 40%, spells cast under that threshold deal +25% spell damage. The boost ends once mana rises above 35%.",
    spells: ["Pitfalls", "Wrath", "Fountain of Knowledge", "Revelation"],
    penalties: ["-20% TPA"],
    units: [
      "Soldier: 3/0 (0.75nw)",
      "Offensive Specialist: 10/0 (4.0nw)",
      "Defensive Specialist: 0/13 (6.5nw)",
      "Elite Unit: 14/6 (800gc, 7.0nw)",
      "Mercenary: 8/0 (0.0nw)",
      "Prisoner: 8/0 (1.6nw)",
      "War Horse: 2/0 (0.6nw)",
    ],
  },
  {
    name: "Faery",
    bonuses: ["+25% Spell Duration", "+25% WPA", "+1 Mana Recovery per Tick"],
    doctrine: "Provides up to -7.5% damage from enemy Thievery and Magic instant operations to you and all your kingdom.",
    unique: "Leyline Interference: Enemy spells cast against Faery provinces have a 15% chance to fail.",
    spells: [
      "Tree of Gold",
      "Quick Feet",
      "Town Watch",
      "Blizzard",
      "Mage's Fury",
      "Greater Protection",
      "Fountain of Knowledge",
      "Miners Mystique",
      "Pitfalls",
      "Revelation",
      "Animate Dead",
    ],
    penalties: ["-10% BE", "+15% Military Wages"],
    units: [
      "Soldier: 3/0 (0.75nw)",
      "Offensive Specialist: 10/0 (4.0nw)",
      "Defensive Specialist: 0/10 (5.0nw)",
      "Elite Unit: 8/15 (900gc, 9nw)",
      "Mercenary: 8/0 (0.0nw)",
      "Prisoner: 8/0 (1.6nw)",
      "War Horse: 2/0 (0.6nw)",
    ],
  },
  {
    name: "Halfling",
    bonuses: ["+10% Population", "+1 Stealth Regeneration Per Tick", "+20% Thievery Effectiveness (TPA)"],
    doctrine: "Provides up to +7.5% Sabotage damage to you and all your kingdom.",
    unique: "Sneak Attack: When activated, all thievery operations incur zero thievery losses for 1 tick. 23 Hour Cooldown.",
    spells: ["Town Watch", "Greater Protection"],
    penalties: ["+15% Military Casualties"],
    units: [
      "Soldier: 3/0 (0.75nw)",
      "Offensive Specialist: 10/0 (4.0nw)",
      "Defensive Specialist: 0/11 (5.5nw)",
      "Elite Unit: 10/13 (900gc, 8nw)",
      "Mercenary: 8/0 (0.0nw)",
      "Prisoner: 8/0 (1.6nw)",
      "War Horse: 2/0 (0.6nw)",
    ],
  },
  {
    name: "Human",
    bonuses: ["All Lands hold Prisoners - 2 per Acre", "+1 Stealth In War", "+15% Science Efficiency"],
    doctrine: "Provides up to +7.5% Book Generation to you and all your kingdom.",
    unique: "Civil Administration: Prisoners generate an additional 2.0gc per tick and Mercenary costs are reduced by 25%.",
    spells: ["Fountain of Knowledge", "Revelation", "Invisibility", "Guile"],
    penalties: [
      "Military wage increases take twice as long to fully apply; wage reductions apply normally.",
      "+50% Rune Cost (Does not Include Rituals)",
      "-50% Libraries Building Effectiveness",
    ],
    units: [
      "Soldier: 3/0 (0.75nw)",
      "Offensive Specialist: 12/0 (4.8nw)",
      "Defensive Specialist: 0/10 (5.0nw)",
      "Elite Unit: 14/9 (1000gc, 8nw)",
      "Mercenary: 8/0 (0.0nw)",
      "Prisoner: 8/0 (1.6nw)",
      "War Horse: 3/0 (0.9nw)",
    ],
  },
  {
    name: "Orc",
    bonuses: ["+15% Gains", "-50% Draft Cost"],
    doctrine: "Provides up to +7.5% Enemy Military Casualties to you and all your kingdom.",
    unique: "Pillage and Burn: Successful Traditional Marches capture +30% additional Prisoners and Massacre attacks are +15% more effective at killing Wizards.",
    spells: ["Aggression", "Bloodlust"],
    penalties: ["-15% DME"],
    units: [
      "Soldier: 3/0 (0.75nw)",
      "Offensive Specialist: 13/0 (5.2nw)",
      "Defensive Specialist: 0/10 (5nw)",
      "Elite Unit: 20/1 (850gc, 7nw)",
      "Mercenary: 8/0 (0.0nw)",
      "Prisoner: 8/0 (1.6nw)",
      "War Horse: 2/0 (0.6nw)",
    ],
  },
  {
    name: "Undead",
    bonuses: ["-40% Military Losses", "Plague Immunity", "No Food Requirement"],
    doctrine: "Provides -7.5% Enemy Battle Gains to you and all your kingdom.",
    unique: "Plaguebearers: Plague has a 33% chance to spread on all successful attacks.",
    spells: ["Animate Dead"],
    penalties: ["-5% OME"],
    units: [
      "Soldier: 3/0 (0.75nw)",
      "Offensive Specialist: 11/0 (4.4nw)",
      "Defensive Specialist: 0/10 (5.0nw)",
      "Elite Unit: 16/7 (900gc, 8nw)",
      "Mercenary: 8/0 (0.0nw)",
      "Prisoner: 8/0 (1.6nw)",
      "War Horse: 2/0 (0.6nw)",
    ],
  },
];

const personalities: Personality[] = [
  {
    name: "The Artisan",
    bonuses: [
      "+30% Building Capacity (Homes, Stables, Dungeons)",
      "+30% Building Production (Banks, Farms, Stables, Towers)",
      "+100% Successful Espionage Ops",
      "+15% Economy Science Efficiency",
      "Access to Ghost Workers, Greater Protection",
    ],
    starting: ["+600 Soldiers", "+600 Specialist Credits", "+200 Building Credits"],
    unique: "Construction Delays: For 6 ticks after a successful attack, enemy building efficiency is reduced by 10% (does not stack).",
  },
  {
    name: "The Paladin",
    bonuses: [
      "+5% Population",
      "+50% Stables Capacity and Production",
      "Successful attacks inflict +15% enemy military casualties but also suffer +10% offensive military casualties",
      "+15% Valor Science Efficiency",
      "Immune to Plague",
    ],
    starting: ["+800 Soldiers", "+800 Specialist Credits"],
    unique: "Divine Blessing: All daily bonuses (granted on the 1st of each month) are doubled.",
  },
  {
    name: "The Heretic",
    bonuses: [
      "-40% Thief Cost",
      "+25% TPA",
      "+20% Sabotage Damage",
      "+50% Guilds Effectiveness",
      "+15% Arcane Science Efficiency",
      "Access to Nightmares, Fools Gold, Invisibility, Steal Warhorses, Vermin",
    ],
    starting: ["+400 Wizards", "+400 Thieves"],
    unique: "Chaotic Affliction: For two ticks when activated, all offensive spells and sabotage operations gain a random damage bonus between +10% and +30%. Cooldown: 23 ticks.",
  },
  {
    name: "The Mystic",
    bonuses: [
      "+125% Guilds Effectiveness",
      "+1 Mana Recovery per Tick",
      "+15% Channeling Science Efficiency",
      "Access to Pitfalls, Meteor Showers, Chastity, Vermin",
    ],
    starting: ["+800 Wizards"],
    unique: "Focussed Channelling: While above 40% mana, spells gain +20% WPA.",
  },
  {
    name: "The Rogue",
    bonuses: [
      "+100% Thieves' Dens Effectiveness",
      "+15% TPA",
      "+1 Stealth Recovery per Tick",
      "Access to All Thievery Operations",
      "+15% Crime Science Efficiency",
    ],
    starting: ["+800 Thieves"],
    unique: "Shadow Persistence: Rogue provinces may perform thievery operations while overpopulated.",
  },
  {
    name: "The Tactician",
    bonuses: [
      "-15% Attack Time",
      "+40% Specialist Credits Gains",
      "No Thieves lost on intel",
      "+15% Siege Science Efficiency",
      "Enhanced Conquest",
      "Access to Clearsight",
    ],
    starting: ["+800 Soldiers", "+800 Specialist Credits"],
    unique: "Dragon's Wrath: When successfully attacking with a dragon, 3% of your raw offence from units will also deal damage to the dragon.",
  },
  {
    name: "The Warrior",
    bonuses: [
      "+10% Offensive Military Efficiency",
      "+4 Mercenary & Prisoner Strength",
      "-50% Mercenary Cost",
      "+15% Tactics Science Efficiency",
      "Access to Bloodlust",
    ],
    starting: ["+800 Soldiers", "+800 Specialist Credits"],
    unique: "Battle Cry: Upon successful attack, the attack will destroy 1% of the target's total population.",
  },
  {
    name: "The Necromancer",
    bonuses: [
      "+30% WPA",
      "+25% Military Losses converted into Soldiers (your fallen rise again)",
      "+15% Channelling Science Efficiency",
      "Reclaims 30% of enemy military losses as Soldiers on successful attacks",
      "Access to Animate Dead, Mystic Aura, Vermin, Pitfalls, Mind Focus",
    ],
    starting: ["+400 Wizards", "+400 Specialist Credits"],
    unique: "Black Magic: Successful offensive instant spells also inflict necrotic fallout on the target province, killing 1% of target peasants per successful instant spell.",
  },
  {
    name: "The General",
    bonuses: [
      "+1 General",
      "+20% Specialist Credits Gains",
      "-25% Training Cost",
      "Train Elites with Specialist Credits (In War)",
      "+15% Bookkeeping Science Efficiency",
      "Access to Wrath",
    ],
    starting: ["+800 Soldiers", "+800 Specialist Credits"],
    unique: "Generals Authority: Attacks inflict +15% enemy military casualties when two or more generals are sent.",
  },
  {
    name: "The War Hero",
    bonuses: [
      "-30% Honor Losses",
      "Converts Specialists to Elites on Traditional Marches",
      "+2 Offensive Specialist Strength (Affects NW)",
      "+50% Honor Effects",
    ],
    starting: ["+800 Soldiers", "+800 Specialist Credits"],
    unique: "Honour & Glory: All successful attacks generate 2.5% additional honour gains.",
  },
];

const dragonGeneral: string[] = [
  "Elites deal dragon damage based on their higher value (e.g., 14/4 elite deals 14 damage per unit).",
  "Elites no longer combine offence and defence when slaying dragons; only the higher value is used.",
  "Dragon HP reduced by 10%.",
];

const dragonsData: Dragon[] = [
  {
    name: "Amethyst",
    effects: [
      "-40% Spell Success Chance",
      "-40% Thievery Success Chance on sabotage operations",
      "+25% thievery and wizard losses on failed spells and sabotage operations",
    ],
    costModifier: "2.4",
  },
  {
    name: "Emerald",
    effects: ["+25% military casualties in combat", "-20% combat gains", "-40% Building and Specialist Credits gained in combat"],
    costModifier: "2.4",
  },
  {
    name: "Celestite",
    effects: ["-60% Birth Rates", "-40% Hospital Effectiveness", "+50% Build Cost and Time"],
    costModifier: "2.4",
  },
  {
    name: "Ruby",
    effects: ["-15% Military Effectiveness", "+30% Military Wages", "Lose 30% of new draftees"],
    costModifier: "2.4",
  },
  {
    name: "Topaz",
    effects: ["-30% Building Efficiency", "-25% Income", "Destroys 4% of buildings instantly and every 6 days thereafter"],
    costModifier: "2.0",
  },
  {
    name: "Sapphire",
    effects: ["-30% magic (WPA) and thievery (TPA) effectiveness", "+12.5% Instant Spell and Sabotage Damage taken", "-12.5% Instant Spell and Sabotage Damage dealt"],
    costModifier: "2.0",
  },
];

const ritualsData: Ritual[] = [
  {
    name: "Barrier",
    effects: ["+20% Birth Rates", "-25% Damage from Enemy Instant Magic and Thievery Operations", "-20% Massacre Damage", "-10% Battle (Resource) Losses"],
  },
  {
    name: "Expedient",
    effects: ["+20% Building Efficiency", "-25% Construction Cost", "-25% Construction Time", "-25% Military Wages"],
  },
  {
    name: "Ascendancy",
    effects: ["+50% Wizard Production", "-50% Wizard Losses on Failed Spells", "-25% Science Book Production"],
  },
  {
    name: "Haste",
    effects: ["-10% Attack Time", "-25% Training Time", "-25% Construction Time"],
  },
  {
    name: "Havoc",
    effects: ["+20% Offensive WPA", "+20% Offensive TPA", "+20% Spell Damage", "+20% Sabotage Damage"],
  },
  {
    name: "Onslaught",
    effects: ["+10% Offensive Military Efficiency", "+15% Enemy Military Casualties on Attacks"],
  },
  {
    name: "Stalwart",
    effects: ["+5% Defensive Military Efficiency", "-20% Military Casualties"],
  },
];

const tabPanels: Record<string, ReactNode> = {
  overview: (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Schedule</h2>
          <span className={styles.sectionTag}>Age 114</span>
        </div>
        <div className={styles.sectionBody}>
          <ul className={styles.list}>
            <li>WoL Age 114 Open: 25th January 2026 22:00</li>
            <li>WoL Age 114 Start: 28th January 2026</li>
            <li>WoL Age 114 End: TBC</li>
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>The Age of Convergence</h2>
          <span className={styles.sectionTag}>Theme</span>
        </div>
        <div className={styles.sectionBody}>
          <p>For centuries, the realms fought as isolated powers. Each race guarded its traditions. Each kingdom shaped war in its own image. That era is over.</p>
          <p>As conflicts stretched on and old playbooks became predictable, the world adapted. Magic wove into steel. Doctrine replaced impulse. Power no longer flowed from a single source, but grew through alignment.</p>
          <p>In this age, strength is created where paths converge. Races no longer fight in isolation. Their philosophies now shape the battlefield. When a kingdom aligns its forces under shared doctrine, the fight changes:</p>
          <ul className={styles.list}>
            <li>Armies move with purpose</li>
            <li>Spells strike harder</li>
            <li>Defenses hold longer</li>
            <li>Opponents lose control</li>
          </ul>
          <p>Dragons return not as spectacle, but as pressure. They disrupt economies, drain resolve, and force hard choices until they are answered.</p>
          <p>Ambition sharpens leaders. Mastery matters again. Generals, mystics, saboteurs, and engineers leave a lasting impact on every conflict.</p>
          <p>This is an age where: Choices compound. Coordination wins. Neglect is punished. Victory belongs not to the loudest blow, but to the kingdom that aligns its strengths and exploits its moment.</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Core Mechanics &amp; Modifications</h2>
        </div>
        <div className={styles.sectionBody}>
          <ul className={styles.list}>
            <li>Defects no longer ignores kingdom wall if 22 provinces or above.</li>
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>War Doctrines (Battle Doctrines)</h2>
        </div>
        <div className={styles.sectionBody}>
          <p>Each race contributes a War Doctrine that applies kingdom-wide during War. Doctrine strength scales with the number of provinces of that race, up to a defined cap.</p>
          <p className={styles.subheading}>Global Parameters (Applies to All Races)</p>
          <ul className={styles.list}>
            <li>Base Value: 1.5%</li>
            <li>Increment: +1% per province of that race</li>
            <li>Maximum Cap: 7.5%</li>
          </ul>
          <p className={styles.subheading}>Design Guardrails</p>
          <ul className={styles.list}>
            <li>No War Doctrine may exceed 7.5% total effect.</li>
            <li>Caps are designed to be reached at 7 provinces, not earlier.</li>
            <li>Additional provinces beyond the cap do not increase doctrine strength.</li>
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Attack &amp; Ops Changes</h2>
        </div>
        <div className={styles.sectionBody}>
          <p className={styles.subheading}>Massacre</p>
          <ul className={styles.list}>
            <li>Massacre effectiveness in War is now 2x (was 3x).</li>
          </ul>
          <p className={styles.subheading}>Learn and Plunder</p>
          <ul className={styles.list}>
            <li>Learns and Plunders have their enemy military kills reverted to normal troop kills in War.</li>
          </ul>
          <p className={styles.subheading}>Out of War Penalties</p>
          <ul className={styles.list}>
            <li>When targeting a kingdom under 85% of both your Land and Networth:</li>
            <li>Battle Gains: -10%</li>
            <li>Military Casualties: +10%</li>
            <li>Honor Gains: -25%</li>
            <li>Attack Time: +20%</li>
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Spell Changes</h2>
        </div>
        <div className={styles.sectionBody}>
          <ul className={styles.list}>
            <li>Greed increased from 25% to 35% for both Wage and Draft Costs.</li>
          </ul>
        </div>
      </section>
    </>
  ),
  races: (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Races</h2>
      </div>
      <div className={styles.sectionBody}>
        <div className={styles.cardGrid}>
          {races.map((race) => (
            <div className={styles.card} key={race.name}>
              <div className={styles.cardHead}>
                <div>
                  <h3 className={styles.cardTitle}>{race.name}</h3>
                  <p className={styles.cardSubtitle}>Race</p>
                </div>
                <span className={styles.cardBadge}>Doctrine</span>
              </div>
              <div className={styles.cardBody}>
                <p className={styles.cardLabel}>War Doctrine</p>
                <p className={styles.cardText}>{race.doctrine}</p>

                <p className={styles.cardLabel}>Unique</p>
                <p className={styles.cardText}>{race.unique}</p>

                <p className={styles.cardLabel}>Bonuses</p>
                <ul className={styles.list}>
                  {race.bonuses.map((item) => (
                    <li key={`${race.name}-bonus-${item}`}>{item}</li>
                  ))}
                </ul>

                {race.penalties.length > 0 && (
                  <>
                    <p className={styles.cardLabel}>Penalties</p>
                    <ul className={styles.list}>
                      {race.penalties.map((item) => (
                        <li key={`${race.name}-pen-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}

                {race.spells.length > 0 && (
                  <>
                    <p className={styles.cardLabel}>Spells</p>
                    <div className={styles.pillList}>
                      {race.spells.map((spell) => (
                        <span className={styles.pill} key={`${race.name}-spell-${spell}`}>
                          {spell}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                <p className={styles.cardLabel}>Units</p>
                <ul className={styles.list}>
                  {race.units.map((unit) => (
                    <li key={`${race.name}-unit-${unit}`}>{unit}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
  personalities: (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Personalities</h2>
      </div>
      <div className={styles.sectionBody}>
        <div className={styles.cardGrid}>
          {personalities.map((p) => (
            <div className={styles.card} key={p.name}>
              <div className={styles.cardHead}>
                <div>
                  <h3 className={styles.cardTitle}>{p.name}</h3>
                  <p className={styles.cardSubtitle}>Personality</p>
                </div>
                <span className={styles.cardBadge}>Traits</span>
              </div>
              <div className={styles.cardBody}>
                <p className={styles.cardLabel}>Bonuses</p>
                <ul className={styles.list}>
                  {p.bonuses.map((item) => (
                    <li key={`${p.name}-bonus-${item}`}>{item}</li>
                  ))}
                </ul>

                <p className={styles.cardLabel}>Starting Bonuses</p>
                <ul className={styles.list}>
                  {p.starting.map((item) => (
                    <li key={`${p.name}-start-${item}`}>{item}</li>
                  ))}
                </ul>

                <p className={styles.cardLabel}>Unique</p>
                <p className={styles.cardText}>{p.unique}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
  changelog: (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Changelog</h2>
        <span className={styles.sectionTag}>Summary</span>
      </div>
      <div className={styles.sectionBody}>
        <p>[LIST]</p>
      </div>
    </section>
  ),
  dragons: (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Dragons</h2>
      </div>
      <div className={styles.sectionBody}>
        <p>New dragons and reworks emphasize pressure and counter-play.</p>
        <div className={styles.cardGrid}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <h3 className={styles.cardTitle}>General Changes</h3>
                <p className={styles.cardSubtitle}>Applies to all dragons</p>
              </div>
              <span className={styles.cardBadge}>Global</span>
            </div>
            <div className={styles.cardBody}>
              <ul className={styles.list}>
                {dragonGeneral.map((item) => (
                  <li key={`dragon-general-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {dragonsData.map((dragon) => (
            <div className={styles.card} key={dragon.name}>
              <div className={styles.cardHead}>
                <div>
                  <h3 className={styles.cardTitle}>{dragon.name}</h3>
                  <p className={styles.cardSubtitle}>Dragon</p>
                </div>
                {dragon.costModifier ? <span className={styles.cardBadge}>Cost {dragon.costModifier}</span> : <span className={styles.cardBadge}>Cost</span>}
              </div>
              <div className={styles.cardBody}>
                <p className={styles.cardLabel}>Effects</p>
                <ul className={styles.list}>
                  {dragon.effects.map((effect) => (
                    <li key={`${dragon.name}-effect-${effect}`}>{effect}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
  rituals: (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Rituals</h2>
      </div>
      <div className={styles.sectionBody}>
        <div className={styles.cardGrid}>
          {ritualsData.map((ritual) => (
            <div className={styles.card} key={ritual.name}>
              <div className={styles.cardHead}>
                <div>
                  <h3 className={styles.cardTitle}>{ritual.name}</h3>
                  <p className={styles.cardSubtitle}>Ritual</p>
                </div>
                <span className={styles.cardBadge}>Effects</span>
              </div>
              <div className={styles.cardBody}>
                <ul className={styles.list}>
                  {ritual.effects.map((effect) => (
                    <li key={`${ritual.name}-effect-${effect}`}>{effect}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  ),
};

export default function FinalChanges114Page() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Final Changes - Age 114</h1>
          </div>
          <span className={styles.badge}>Age 114</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.content}>
          <Tabs tabs={tabs} panels={tabPanels} />
        </div>
      </div>
    </main>
  );
}


