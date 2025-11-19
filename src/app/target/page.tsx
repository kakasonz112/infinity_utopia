"use client";

import { useState } from "react";
import styles from "./page.module.css";

type Province = {
  slot: number;
  name: string;
  race: string;
  land: number;
  nw: number;
};

// valid race list
const RACES = [
  "Avian",
  "Dark",
  "Elf",
  "Dwarf",
  "Faery",
  "Gnome",
  "Halfling",
  "Human",
  "Orc",
  "Undead",
];

// -------------------------------------
// NEW SMART PARSER FOR UTOPIA EXPORT FORMAT
// -------------------------------------
const parseKingdom = (text: string): Province[] => {
  const lines = text.trim().split("\n");
  const provinces: Province[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);

    // slot = first number
    const slot = parseInt(parts[0]);
    if (!slot) continue;

    // find race index
    let raceIndex = -1;
    for (let i = 1; i < parts.length; i++) {
      if (RACES.includes(parts[i])) {
        raceIndex = i;
        break;
      }
    }
    if (raceIndex === -1) continue;

    const race = parts[raceIndex];

    // name = everything between slot and race
    const nameParts = parts.slice(1, raceIndex);
    const name = nameParts.join(" ");

    // find land (ends with "a")
    const landPart = parts.find((p) => p.endsWith("a"));
    if (!landPart) continue;
    const land = parseInt(landPart.replace(/[^0-9]/g, ""));

    // find NW = first occurrence ending with "gc"
    const nwPart = parts.find((p) => p.endsWith("gc"));
    if (!nwPart) continue;
    const nw = parseInt(nwPart.replace(/[^0-9]/g, ""));

    provinces.push({
      slot,
      name,
      race,
      land,
      nw,
    });
  }

  return provinces;
};

// -------------------------------------
// MATCHING ALGO (ALWAYS ASSIGN VERSION B)
// -------------------------------------
const computeMatchesAlgo = (own: Province[], enemy: Province[]) => {
  const assigned: any[] = [];
  const usedEnemy = new Set<number>();

  const ratio = (ownNW: number, enemyNW: number) =>
    (enemyNW / ownNW) * 100;

  for (const o of own) {
    const available =
      enemy.filter((e) => !usedEnemy.has(e.slot)).length > 0
        ? enemy.filter((e) => !usedEnemy.has(e.slot))
        : enemy; // allow reuse

    const candidates = available.map((e) => ({
      enemy: e,
      r: ratio(o.nw, e.nw),
    }));

    let best;

    // in 80–120 range
    const inRange = candidates.filter((c) => c.r >= 80 && c.r <= 120);

    if (inRange.length > 0) {
      inRange.sort((a, b) => {
        const da = Math.abs(a.r - 110);
        const db = Math.abs(b.r - 110);
        if (da !== db) return da - db;
        return Math.abs(a.r - 100) - Math.abs(b.r - 100);
      });
      best = inRange[0];
    } else {
      // fallback
      candidates.sort((a, b) => {
        const distA = Math.min(Math.abs(a.r - 80), Math.abs(a.r - 120));
        const distB = Math.min(Math.abs(b.r - 80), Math.abs(b.r - 120));
        return distA - distB;
      });
      best = candidates[0];
    }

    assigned.push({
      own: o,
      enemy: best.enemy,
      ratio: best.r,
    });

    if (usedEnemy.size < enemy.length) usedEnemy.add(best.enemy.slot);
  }

  const unassignedEnemy = enemy.filter((e) => !usedEnemy.has(e.slot));
  return { assigned, unassignedEnemy };
};

export default function KingdomTargetMatcher() {
  const [ownInput, setOwnInput] = useState("");
  const [enemyInput, setEnemyInput] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [unassignedEnemy, setUnassignedEnemy] = useState<any[]>([]);
  const [unassignedOwn, setUnassignedOwn] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  const computeMatches = () => {
    const own = parseKingdom(ownInput);
    const enemy = parseKingdom(enemyInput);

    const { assigned, unassignedEnemy } = computeMatchesAlgo(own, enemy);

    const assignedOwnSlots = new Set(assigned.map((a) => a.own.slot));
    const unassignedOwn = own.filter((o) => !assignedOwnSlots.has(o.slot));

    setResults(assigned);
    setUnassignedEnemy(unassignedEnemy);
    setUnassignedOwn(unassignedOwn);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Kingdom Target Matcher</h1>

      <div className={styles.grid}>
        <textarea
          className={styles.textarea}
          placeholder={
            `Paste OWN kingdom table here
COPY FORMAT from OWN KINGDOM PAGE:

1   [Name]          [Race] 000a    000,000gc  000gc  [Title] 00
2   [Name]          [Race] 000a    000,000gc  000gc  [Title] 00
            `
            }
          value={ownInput}
          onChange={(e) => setOwnInput(e.target.value)}
        />

        <textarea
          className={styles.textarea}
          placeholder={
            `Paste ENEMY kingdom table here
COPY FORMAT from ENEMY KINGDOM PAGE:

1   [Name]          [Race] 000a    000,000gc  000gc  [Title] 00
2   [Name]          [Race] 000a    000,000gc  000gc  [Title] 00
            `
            }
          value={enemyInput}
          onChange={(e) => setEnemyInput(e.target.value)}
        />
      </div>

      <button className={styles.button} onClick={computeMatches}>
        Compute Targets
      </button>

      {results.length > 0 && (
        <div className={styles.tableContainer}>
<div className={styles.titleRow}>
  <h2 className={styles.title}>Assigned Targets</h2>

  <div className={styles.actionBox}>
    <button
      className={styles.copyButton}
      onClick={() => {
        const text = results
          .map(
            (r) =>
              `#${r.own.slot} ${r.own.name}  →  #${r.enemy.slot} ${r.enemy.name}   (${r.ratio.toFixed(1)}%)`
          )
          .join("\n");

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      Copy
    </button>

    {copied && <span className={styles.copiedText}>Copied!</span>}
  </div>
</div>


          <table className={styles.table}>
            <thead>
              <tr>
                <th>Own Slot</th>
                <th>Own Province</th>
                <th>Enemy Slot</th>
                <th>Enemy Province</th>
                <th>Ratio (%)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{`#${r.own.slot}`}</td>
                  <td>{r.own.name}</td>
                  <td>{`#${r.enemy.slot}`}</td>
                  <td>{r.enemy.name}</td>
                  <td>{r.ratio.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unassignedOwn.length > 0 && (
        <div className={styles.tableContainer}>
          <h2 className={styles.title}>Unassigned Own Provinces</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Own Slot</th>
                <th>Own Province</th>
                <th>NW</th>
              </tr>
            </thead>
            <tbody>
              {unassignedOwn.map((o) => (
                <tr key={o.slot}>
                  <td>{`#${o.slot}`}</td>
                  <td>{o.name}</td>
                  <td>{o.nw.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unassignedEnemy.length > 0 && (
        <div className={styles.tableContainer}>
          <h2 className={styles.title}>Unassigned Enemy Provinces</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Enemy Slot</th>
                <th>Enemy Province</th>
                <th>NW</th>
              </tr>
            </thead>
            <tbody>
              {unassignedEnemy.map((e) => (
                <tr key={e.slot}>
                  <td>{`#${e.slot}`}</td>
                  <td>{e.name}</td>
                  <td>{e.nw.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
