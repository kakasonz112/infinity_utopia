"use client";

import React, { useMemo, useState } from "react";
import styles from "./page.module.css";

const UT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "Jul"];
const DAYS_PER_MONTH = 24;
const DAYS_PER_CYCLE = UT_MONTHS.length * DAYS_PER_MONTH; // 168
const CEASEFIRE_HOURS = 97; // 97 ticks
const HORSE_GROWTH_TICKS = 29;

type UtDate = {
  day: number;   // 1-24
  month: number; // 0-6
  year: number;  // 0-11 (game starts at Jan Yr0)
};

function utDateToTicks(date: UtDate): number {
  const yearOffset = date.year * DAYS_PER_CYCLE;
  const monthOffset = date.month * DAYS_PER_MONTH;
  const dayOffset = date.day - 1;
  return yearOffset + monthOffset + dayOffset;
}

function ticksToUtDate(ticks: number): UtDate {
  const year = Math.floor(ticks / DAYS_PER_CYCLE);
  const withinYear = ticks % DAYS_PER_CYCLE;
  const month = Math.floor(withinYear / DAYS_PER_MONTH);
  const day = (withinYear % DAYS_PER_MONTH) + 1;
  return { day, month, year };
}

function formatUtDate(date: UtDate): string {
  const month = UT_MONTHS[date.month];
  const day = String(date.day).padStart(2, " ");
  return `${month} ${day} yr${date.year}`; // e.g. "Feb 17 yr3"
}


function computeCfPhases(params: {
  start: UtDate;
  ritualOffsetFromStart: number;
  draftOffsetBeforeEnd: number;
  armouriesBuildTicks: number;
  armyTrainTicks: number;
}) {
  const startTick = utDateToTicks(params.start);
  const endTick = startTick + CEASEFIRE_HOURS;

  // Training day tick (used as reference for several offsets)
  const activateRitualTrainingTick = endTick - params.armyTrainTicks;

  const cfEnd = ticksToUtDate(endTick);
  const startRitual = ticksToUtDate(startTick + params.ritualOffsetFromStart);
  // Draft time is relative to the training day, not CF end
  const draftTime = ticksToUtDate(activateRitualTrainingTick - params.draftOffsetBeforeEnd);
  const wages200 = ticksToUtDate(endTick - 48);

  const stablesBuildTime = params.armouriesBuildTicks;
  const stablesBuildStart = ticksToUtDate(
    endTick - (HORSE_GROWTH_TICKS + stablesBuildTime),
  );
  const lpForHorses = ticksToUtDate(endTick - HORSE_GROWTH_TICKS);

  // Activate ritual & training day = army training window before CF end
  const activateRitualTraining = ticksToUtDate(activateRitualTrainingTick);

  // Build Armouries: start so that build finishes by the training day
  const armouriesStartTick = activateRitualTrainingTick - params.armouriesBuildTicks;
  const armouriesStart = ticksToUtDate(armouriesStartTick);
  const convertWarBuilds = ticksToUtDate(endTick - Math.round(stablesBuildTime * 0.75));

  return {
    cfEnd,
    startRitual,
    draftTime,
    wages200,
    stablesBuildStart,
    lpForHorses,
    armouriesStart,
    activateRitualTraining,
    convertWarBuilds,
    stablesBuildTime,
  };
}

export default function CfPlannerPage() {
  const [startDay, setStartDay] = useState<number | "">(1);
  const [startMonth, setStartMonth] = useState<number>(0); // Jan
  const [startYear, setStartYear] = useState<number | "">(0);

  const [ritualOffsetFromStart, setRitualOffsetFromStart] = useState<number | "">(34);
  const [draftOffsetBeforeEnd, setDraftOffsetBeforeEnd] = useState<number | "">(42);
  const [armouriesBuildTicks, setArmouriesBuildTicks] = useState<number | "">(12);
  const [armyTrainTicks, setArmyTrainTicks] = useState<number | "">(14);
  const [afterRitualBuildTicks, setAfterRitualBuildTicks] = useState<number | "">(9);


  const [isCopying, setIsCopying] = useState(false);

  // Helper to coerce possibly-empty input states into numbers with sensible defaults
  const parseNumber = (v: number | "", def: number) => {
    if (v === "" || v === null || v === undefined) return def;
    const n = Number(v);
    return Number.isNaN(n) ? def : n;
  };

  const phases = computeCfPhases({
    start: {
      day: parseNumber(startDay, 1),
      month: startMonth,
      year: parseNumber(startYear, 0),
    },
    ritualOffsetFromStart: parseNumber(ritualOffsetFromStart, 34),
    draftOffsetBeforeEnd: parseNumber(draftOffsetBeforeEnd, 44),
    armouriesBuildTicks: parseNumber(armouriesBuildTicks, 12),
    armyTrainTicks: parseNumber(armyTrainTicks, 14),
  });

  const discordText = useMemo(() => {
    const lines = [
      `${formatUtDate(phases.startRitual)}     Start Ritual`,
      `${formatUtDate(phases.draftTime)}     Approximate Drafting Time(${draftOffsetBeforeEnd}h) (Check your own)`,
      `${formatUtDate(phases.wages200)}     Wages to 200% (48h until eowcf), recommended time to build homes`,
      `${formatUtDate(phases.stablesBuildStart)}     Attackers – Build Stables (${phases.stablesBuildTime}h build)`,
      `${formatUtDate(phases.lpForHorses)}     Attackers – L&P for horses`,
      `${formatUtDate(phases.armouriesStart)}     Build Armouries (${armouriesBuildTicks}h w. BB)`,
      `${formatUtDate(phases.activateRitualTraining)}     Activate Ritual & Training Day (${armyTrainTicks}h training time)`,
      `${formatUtDate(phases.convertWarBuilds)}     Convert into war builds (${afterRitualBuildTicks}h build time)`,
      `${formatUtDate(phases.cfEnd)}     End of CF`,
    ];

    // Wrap in Discord code block for easy paste
    return "```\n" + lines.join("\n") + "\n```";
  }, [phases, armouriesBuildTicks, armyTrainTicks]);

    const handleCopy = async () => {
    try {
        setIsCopying(true);
        await navigator.clipboard.writeText(discordText);
        setTimeout(() => setIsCopying(false), 1300);
    } catch {
        setIsCopying(false);
    }
    };


  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>EoWCF Planner</h1>
            <p className={styles.subtitle}>
              Plan your EoWCF phases by ticks using the Utopia calendar.
            </p>
          </div>
          <div className={styles.badge}>Utopia Tool</div>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>CF Start Date</h2>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>Day (1-24)</span>
              <input
                type="number"
                min={1}
                max={24}
                value={startDay}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setStartDay("");
                  setStartDay(Math.min(24, Math.max(1, Number(v))));
                }}
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Month</span>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className={styles.select}
              >
                {UT_MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Year (0-11)</span>
              <input
                type="number"
                min={0}
                max={11}
                value={startYear}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setStartYear("");
                  setStartYear(Math.min(11, Math.max(0, Number(v))));
                }}
                className={styles.input}
              />
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Phase Settings</h2>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>
                Start Ritual (ticks after CF start)
              </span>
              <input
                type="number"
                min={1}
                max={72}
                value={ritualOffsetFromStart}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setRitualOffsetFromStart("");
                  setRitualOffsetFromStart(Math.min(72, Math.max(1, Number(v))));
                }}
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>
                Approx Drafting Time (ticks before Training)
              </span>
              <input
                type="number"
                min={1}
                max={60}
                value={draftOffsetBeforeEnd}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setDraftOffsetBeforeEnd("");
                  setDraftOffsetBeforeEnd(Math.min(60, Math.max(1, Number(v))));
                }}
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Current Build Time (ticks)</span>
              <input
                type="number"
                min={1}
                max={48}
                value={armouriesBuildTicks}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setArmouriesBuildTicks("");
                    setAfterRitualBuildTicks("");
                    return;
                  }
                  const v = Math.min(48, Math.max(1, Number(raw)));
                  setArmouriesBuildTicks(v);
                  setAfterRitualBuildTicks(Math.round(v * 0.75));
                }}
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Army Training Time (ticks)</span>
              <input
                type="number"
                min={1}
                max={48}
                value={armyTrainTicks}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setArmyTrainTicks("");
                  setArmyTrainTicks(Math.min(48, Math.max(1, Number(v))));
                }}
                className={styles.input}
              />
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.scheduleHeaderRow}>
            <h2 className={styles.sectionTitle}>Schedule</h2>
            <button
              type="button"
              onClick={handleCopy}
              className={`${styles.copyButton} ${
                isCopying ? styles.copyButtonActive : ""
              }`}
            >
              {isCopying ? "Copied" : "Copy for Discord"}
            </button>
          </div>

          <ul className={styles.scheduleList}>
            <li className={styles.scheduleItem}>
              <span className={styles.scheduleDate}>
                {formatUtDate(phases.startRitual)}
              </span>
              <span className={styles.scheduleText}>Start Ritual</span>
            </li>

            <li className={styles.scheduleItem}>
              <span className={styles.scheduleDate}>
                {formatUtDate(phases.draftTime)}
              </span>
              <span className={styles.scheduleText}>
                Approximate Drafting Time ({draftOffsetBeforeEnd}h) (Check your own)
              </span>
            </li>

            <li className={styles.scheduleItem}>
              <span className={styles.scheduleDate}>
                {formatUtDate(phases.wages200)}
              </span>
              <span className={styles.scheduleText}>
                Wages to 200% (48h until eowcf), recommended time to build homes
              </span>
            </li>

            <li className={styles.scheduleItem}>
              <span className={styles.scheduleDate}>
                {formatUtDate(phases.stablesBuildStart)}
              </span>
              <span className={styles.scheduleText}>
                Attackers – Build Stables ({phases.stablesBuildTime}h build)
              </span>
            </li>

            <li className={styles.scheduleItem}>
              <span className={styles.scheduleDate}>
                {formatUtDate(phases.lpForHorses)}
              </span>
              <span className={styles.scheduleText}>
                Attackers – L&amp;P for horses
              </span>
            </li>

            <li className={styles.scheduleItem}>
              <span className={styles.scheduleDate}>
                {formatUtDate(phases.armouriesStart)}
              </span>
              <span className={styles.scheduleText}>
                Build Armouries ({armouriesBuildTicks}h w. BB)
              </span>
            </li>

            <li className={styles.scheduleItem}>
              <span className={styles.scheduleDate}>
                {formatUtDate(phases.activateRitualTraining)}
              </span>
              <span className={styles.scheduleText}>
                Activate Ritual &amp; Training Day ({armyTrainTicks}h training
                time)
              </span>
            </li>

            <li className={styles.scheduleItem}>
              <span className={styles.scheduleDate}>
                {formatUtDate(phases.convertWarBuilds)}
              </span>
              <span className={styles.scheduleText}>
                Convert into war builds ({afterRitualBuildTicks}h build time)
              </span>
            </li>

            <li className={styles.scheduleItem}>
              <span className={styles.scheduleDate}>
                {formatUtDate(phases.cfEnd)}
              </span>
              <span className={styles.scheduleText}>End of CF</span>
            </li>
          </ul>

          {/* Hidden but accessible code block preview if you want to see raw text */}
          <pre className={styles.discordPreview}>{discordText}</pre>
        </section>
      </div>
    </main>
  );
}
