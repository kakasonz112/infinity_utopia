"use client";

import React, { useState } from "react";
import styles from "./page.module.css";
import { parseProvinceNews } from "../../lib/provinceParser";

type ParsedAttackType =
  | "land"
  | "plunder"
  | "raze"
  | "massacre"
  | "fail"
  | "other";

type ParsedAttack = {
  raw: string;
  date: string;
  attackerProv?: string;
  attackerKd?: string;
  defenderProv?: string;
  defenderKd?: string;
  type: ParsedAttackType;
  acres?: number;
  books?: number;
  kills?: number;
  category?: string; // high-level event category (Traditional March, Plunder, Raze...)
  isOutgoing: boolean; // from inferred our kd POV
};

type SummaryTotalsSide = {
  count: number;
  landCount: number;
  landAcres: number;
  plunderCount: number;
  plunderBooks: number;
  razeCount: number;
  razeAcres: number;
  massacreCount: number;
  massacreKills: number;
  failCount: number;
  uniques: number;
};

type SummaryResult = {
  timeWindow: {
    from: string;
    to: string;
  };
  totals: {
    made: SummaryTotalsSide;
    suffered: SummaryTotalsSide;
  };
};

// Mutable so the user can override via UI inputs before processing
let OUR_KD = "3:12";
let ENEMY_KD = "6:7";

// Hours used for unique counting window (shared single definition)
const UNIQUE_WINDOW_HOURS = 5;

// Categories that count toward made/suffered tallies
const COUNT_CATEGORIES = new Set([
  'Traditional March',
  'Ambush',
  'Conquest',
  'Raze',
  'Massacre',
  'Plunder',
  'Learn',
  'Failed Attack',
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferOurKdFromLines(lines: string[]) {
  for (const line of lines) {
    if (!/our\s+kingdom/i.test(line)) continue;
    const m = line.match(/our\s+kingdom\s*\((\d+:\d+)\)/i);
    if (m) return m[1];
  }
  return undefined;
}

function inferEnemyKdFromLines(lines: string[]) {
  const patterns = [
    /we\s+have\s+declared\s+WAR\s+on/i,
    /has\s+declared\s+WAR\s+with\s+our\s+kingdom/i,
    /against\s+us/i,
    /targeted\s+at\s+us/i,
    /ravaging\s+our\s+lands/i,
    /our\s+kingdom\s+has\s+cancelled\s+the\s+dragon\s+project\s+to/i,
    /our\s+kingdom\s+has\s+begun\s+the\s+.*dragon\s+project/i,
    /our\s+kingdom\s+has\s+withdrawn\s+from\s+war\s+with/i,
  ];

  for (const line of lines) {
    if (!patterns.some((p) => p.test(line))) continue;
    const m = line.match(/\((\d+:\d+)\)/);
    if (m) return m[1];
  }
  return undefined;
}

// Convert a date string like "May 8 of YR3" to a monotonic tick for sorting
function parseTickFromLine(line: string): number | null {
  const m = line.match(/^([A-Za-z]+)\s+(\d+)\s+of\s+YR(\d+)/i);
  if (!m) return null;
  const monthName = m[1].toLowerCase();
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const UT_SHORTS = ["jan", "feb", "mar", "apr", "may", "jun", "jul"];
  const monthIndex = UT_SHORTS.indexOf(monthName.slice(0, 3));
  if (monthIndex === -1) return null;
  const DAYS_PER_MONTH = 24;
  const DAYS_PER_CYCLE = UT_SHORTS.length * DAYS_PER_MONTH;
  const zeroBased = year * DAYS_PER_CYCLE + monthIndex * DAYS_PER_MONTH + (day - 1);
  return zeroBased + 1; // 1-based
}

function normalizeProvKey(raw: string | undefined) {
  if (!raw) return null;
  const s = raw.toString().trim();
  const m = s.match(/^\s*(\d+)\s*-\s*(.*)$/);
  if (m) return `${m[1]} - ${m[2].trim()}`;
  if (/an unknown province/i.test(s)) return "An unknown Province";
  return s;
}

// Compute uniques for a kingdom based on attacker provinces using a window (hours)
// Ambush does not consume a unique per spec.
function computeUniquesByAttacker(attacks: ParsedAttack[], kd: string, windowHours: number) {
  const lastByAttacker: Record<string, number> = {};
  const countByAttacker: Record<string, number> = {};
  for (const a of attacks) {
    if (a.attackerKd !== kd) continue;
    if (a.category === "Ambush") continue;
    const tick = (a as any)._tick || 0;
    const key = (normalizeProvKey(a.attackerProv) || a.attackerProv || "An unknown Province").toString();
    const last = lastByAttacker[key];
    if (last === undefined || (tick - last) >= windowHours) {
      countByAttacker[key] = (countByAttacker[key] || 0) + 1;
      lastByAttacker[key] = tick;
    }
  }
  const total = Object.values(countByAttacker).reduce((s, v) => s + v, 0);
  const entries = Object.entries(countByAttacker).sort((a, b) => b[1] - a[1]);
  return { total, entries };
}

function detailedSummaryUI(attacks: ParsedAttack[], lines: string[]) {
  const firstLine = lines[0] || "";
  const lastLine = lines[lines.length - 1] || "";
  const first = (firstLine.match(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)/i) || [])[1] || "";
  const last = (lastLine.match(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)/i) || [])[1] || "";

  const made = attacks.filter((a) => a.attackerKd === OUR_KD);
  const suffered = attacks.filter((a) => {
    if (a.defenderKd === OUR_KD) return true;
    const raw = (a.raw || "");
    if (raw.includes(`(${OUR_KD})`) && a.attackerKd !== OUR_KD) {
      const kdPattern = escapeRegExp(OUR_KD);
      const attackerPattern = new RegExp(`\\(\\s*${kdPattern}\\s*\\)\\s*(?:captured|invaded|attacked|attempted|set|sent)`, "i");
      const defenderPattern = new RegExp(`(?:captured|invaded|attacked|attempted|razed|recaptured|ambush|killed|looted|pillag)[\\s\\S]*\\(\\s*${kdPattern}\\s*\\)`, "i");
      if (defenderPattern.test(raw)) return true;
      if (!attackerPattern.test(raw) && /invaded|attacked|attempted|captured|razed|recaptured|ambush|killed|looted|pillag/i.test(raw)) return true;
    }
    return false;
  });

  const { total: uniqMadeCount } = computeUniquesByAttacker(attacks, OUR_KD, UNIQUE_WINDOW_HOURS);
  // For suffered, count uniques by incoming attacker provinces (any kd) hitting us, excluding ambush
  const lastTickSuf: Record<string, number> = {};
  let uniqSufCount = 0;
  for (const a of attacks) {
    if (a.defenderKd === OUR_KD && a.category !== "Ambush") {
      const key = (normalizeProvKey(a.attackerProv) || a.attackerProv || "An unknown Province").toString();
      const lastT = lastTickSuf[key];
      const tick = (a as any)._tick || 0;
      if (lastT === undefined || (tick - lastT) >= UNIQUE_WINDOW_HOURS) {
        uniqSufCount++;
        lastTickSuf[key] = tick;
      }
    }
  }

  const stats = (list: ParsedAttack[]) => {
    const cats: any = {
      'Traditional March': { count: 0, acres: 0 },
      'Ambush': { count: 0, acres: 0 },
      'Conquest': { count: 0, acres: 0 },
      'Raze': { count: 0, acres: 0 },
      'Massacre': { count: 0, kills: 0 },
      'Plunder': { count: 0 },
      'Learn': { count: 0, books: 0 },
      'Failed Attack': { count: 0 },
    };
    for (const a of list) {
      const c = a.category || 'Other';
      if (!cats[c]) cats[c] = { count: 0, acres: 0 };
      cats[c].count += 1;
      if (a.acres) cats[c].acres = (cats[c].acres || 0) + a.acres;
      if (a.books) cats[c].books = (cats[c].books || 0) + a.books;
      if (a.kills) cats[c].kills = (cats[c].kills || 0) + a.kills;
    }
    const overallAcres = (cats['Traditional March'].acres || 0) + (cats['Ambush'].acres || 0) + (cats['Conquest'].acres || 0);
    const overallCount = Object.values(cats).reduce((s: number, v: any) => s + (v.count || 0), 0);
    return { cats, overallAcres, overallCount };
  };

  const madeStats = stats(made);
  const sufStats = stats(suffered);

  // Build per-province net list for OUR_KD
  const provMap: Record<string, { acres: number; made: number; suffered: number }> = {};
  const attackCats = new Set(['Traditional March','Ambush','Conquest','Raze','Massacre','Plunder','Failed Attack','Learn']);
  const attackLikeRegex = /invaded|attacked|captured|killed|looted|recaptured|razed|pillag|pillaged|ambush|massacre/i;
  for (const a of attacks) {
    if (a.attackerKd === OUR_KD && a.attackerProv) {
      const raw = normalizeProvKey(a.attackerProv) || a.attackerProv;
      const k = raw as string;
      if (!provMap[k]) provMap[k] = { acres: 0, made: 0, suffered: 0 };
      const addAcres = (a.category === 'Raze') ? 0 : (a.acres || 0);
      if (addAcres) provMap[k].acres += addAcres;
      provMap[k].made += 1;
    }
    if (a.defenderKd === OUR_KD && a.defenderProv) {
      const raw = normalizeProvKey(a.defenderProv) || a.defenderProv;
      const k = raw as string;
      if (!provMap[k]) provMap[k] = { acres: 0, made: 0, suffered: 0 };
      if (a.category === 'Raze') {
        // no acres change
      } else if (a.acres) provMap[k].acres -= a.acres;
      provMap[k].suffered += 1;
    }
  }

  const provEntries = Object.entries(provMap).map(([prov, v]) => ({ prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
  const filtered = provEntries.filter((e) => {
    if (!e.prov || !e.prov.toString().trim()) return false;
    const p = e.prov.toString();
    if (/dragon|topaz|our kingdom|world divided/i.test(p)) return false;
    if (/^\s*-\s*/.test(p)) return false;
    return true;
  });

  const combinedMap: Record<string, { prov: string; acres: number; made: number; suffered: number }> = {};
  for (const e of filtered) {
    const rawProvStr = (e.prov || '').toString();
    const m = rawProvStr.match(/^\s*(\d+)\s*-\s*(.*)$/);
    let id, name;
    if (m) { id = m[1]; name = m[2]; }
    else { if (/an unknown province/i.test(rawProvStr)) { id = ''; name = 'An unknown Province'; } else { id = ''; name = rawProvStr.trim(); } }
    const key = `${id}|${name}`;
    if (!combinedMap[key]) combinedMap[key] = { prov: id ? `${name}` : `${name}`, acres: 0, made: 0, suffered: 0 };
    combinedMap[key].acres += e.acres || 0;
    combinedMap[key].made += e.made || 0;
    combinedMap[key].suffered += e.suffered || 0;
  }

  const displayProvEntries = Object.entries(combinedMap).map(([k, v]) => ({ prov: v.prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
  displayProvEntries.sort((a, b) => (b.acres || 0) - (a.acres || 0));

  const netTotal = displayProvEntries.reduce((s, e) => s + e.acres, 0);
  const madeCount = made.filter((a) => COUNT_CATEGORIES.has(a.category || '')).length;
  const sufferedCount = suffered.filter((a) => COUNT_CATEGORIES.has(a.category || '')).length;

  const out: string[] = [];
  out.push('Kingdom News Report');
  out.push(`${first} - ${last}`);
  out.push(`Total Attacks Made: ${madeStats.overallCount} (${madeStats.overallAcres} acres)`);
  out.push(`Uniques: ${uniqMadeCount}`);
  out.push(`Trad March: ${madeStats.cats ? madeStats.cats['Traditional March'].count : 0} (${madeStats.cats ? madeStats.cats['Traditional March'].acres : 0} acres)`);
  out.push(`Ambush: ${madeStats.cats ? madeStats.cats['Ambush'].count : 0} (${madeStats.cats ? madeStats.cats['Ambush'].acres : 0} acres)`);
  out.push(`Conquest: ${madeStats.cats ? madeStats.cats['Conquest'].count : 0} (${madeStats.cats ? madeStats.cats['Conquest'].acres : 0} acres)`);
  out.push(`Raze: ${madeStats.cats ? madeStats.cats['Raze'].count : 0} (${madeStats.cats ? madeStats.cats['Raze'].acres : 0} acres)`);
  out.push(`Learn: ${madeStats.cats ? madeStats.cats['Learn'].count : 0} (${madeStats.cats && madeStats.cats['Learn'] ? madeStats.cats['Learn'].books || 0 : 0} books)`);
  out.push(`Massacre: ${madeStats.cats ? madeStats.cats['Massacre'].count : 0} (${madeStats.cats && madeStats.cats['Massacre'] ? madeStats.cats['Massacre'].kills || 0 : 0} people)`);
  out.push(`Plunder: ${madeStats.cats ? madeStats.cats['Plunder'].count : 0}`);
  out.push(`Bounces: ${madeStats.cats ? madeStats.cats['Failed Attack'].count || 0 : 0}`);

  out.push('');
  out.push(`Total Attacks Suffered: ${sufStats.overallCount} (${sufStats.overallAcres} acres)`);
  out.push(`Uniques: ${uniqSufCount}`);
  out.push(`Trad March: ${sufStats.cats ? sufStats.cats['Traditional March'].count : 0} (${sufStats.cats ? sufStats.cats['Traditional March'].acres : 0} acres)`);
  out.push(`Ambush: ${sufStats.cats ? sufStats.cats['Ambush'].count : 0} (${sufStats.cats ? sufStats.cats['Ambush'].acres : 0} acres)`);
  out.push(`Conquest: ${sufStats.cats ? sufStats.cats['Conquest'].count : 0} (${sufStats.cats ? sufStats.cats['Conquest'].acres : 0} acres)`);
  out.push(`Raze: ${sufStats.cats ? sufStats.cats['Raze'].count : 0} (${sufStats.cats ? sufStats.cats['Raze'].acres : 0} acres)`);
  out.push(`Learn: ${sufStats.cats ? sufStats.cats['Learn'].count : 0} (${sufStats.cats && sufStats.cats['Learn'] ? sufStats.cats['Learn'].books || 0 : 0} books)`);
  out.push(`Massacre: ${sufStats.cats ? sufStats.cats['Massacre'].count : 0} (${sufStats.cats && sufStats.cats['Massacre'] ? sufStats.cats['Massacre'].kills || 0 : 0} people)`);
  out.push(`Plunder: ${sufStats.cats ? sufStats.cats['Plunder'].count : 0}`);
  out.push(`Bounces: ${sufStats.cats ? sufStats.cats['Failed Attack'].count || 0 : 0}`);

  out.push('');
  out.push(`Own Kingdom ${OUR_KD}`);
  out.push(`Total Acres: ${netTotal} (${madeCount}/${sufferedCount})`);
  for (const e of displayProvEntries) {
    const provStr = (e.prov || '').toString();
    const m = provStr.match(/^\s*(\d+)\s*-\s*(.*)$/);
    if (m) {
      const id = m[1];
      const name = m[2];
      out.push(`${e.acres} | ${id} - ${name} (${e.made}/${e.suffered})`);
    } else if (/an unknown province/i.test(provStr)) {
      out.push(`${e.acres} | An unknown Province (${e.made}/${e.suffered})`);
    } else {
      const name = provStr || 'An unknown Province';
      out.push(`${e.acres} | ${name} (${e.made}/${e.suffered})`);
    }
  }

  // Enemy breakdown for chosen enemy kd
  const enemyMap: Record<string, { acres: number; made: number; suffered: number }> = {};
  for (const a of attacks) {
    if (a.attackerKd === ENEMY_KD && a.attackerProv) {
      const key = normalizeProvKey(a.attackerProv) || a.attackerProv;
      if (!enemyMap[key]) enemyMap[key] = { acres: 0, made: 0, suffered: 0 };
      const addAcres = (a.category === 'Raze') ? 0 : (a.acres || 0);
      if (addAcres) enemyMap[key].acres += addAcres;
      if (attackCats.has(a.category || '') || (a.raw && attackLikeRegex.test(a.raw))) enemyMap[key].made += 1;
    }
    if (a.defenderKd === ENEMY_KD && a.defenderProv) {
      const key = normalizeProvKey(a.defenderProv) || a.defenderProv;
      if (!enemyMap[key]) enemyMap[key] = { acres: 0, made: 0, suffered: 0 };
      if (a.category === 'Raze') {
        // no acres change
      } else if (a.acres) enemyMap[key].acres -= a.acres;
      if (attackCats.has(a.category || '') || (a.raw && attackLikeRegex.test(a.raw))) enemyMap[key].suffered += 1;
    }
  }

  const enemyEntries = Object.entries(enemyMap).map(([prov, v]) => ({ prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
  const enemyFiltered = enemyEntries.filter((e) => {
    if (!e.prov || !e.prov.toString().trim()) return false;
    const p = e.prov.toString();
    if (/dragon|topaz|our kingdom|world divided/i.test(p)) return false;
    if (/^\s*-\s*/.test(p)) return false;
    return true;
  });

  const enemyCombined: Record<string, { prov: string; acres: number; made: number; suffered: number }> = {};
  for (const e of enemyFiltered) {
    const rawProvStr2 = (e.prov || '').toString();
    const m2 = rawProvStr2.match(/^\s*(\d+)\s*-\s*(.*)$/);
    let id2, name2;
    if (m2) { id2 = m2[1]; name2 = m2[2]; }
    else { if (/an unknown province/i.test(rawProvStr2)) { id2 = 'xxx'; name2 = 'An unknown Province'; } else { id2 = ''; name2 = rawProvStr2.trim(); } }
    const key2 = `${id2}|${name2}`;
    if (!enemyCombined[key2]) enemyCombined[key2] = { prov: id2 ? `${name2}` : `${name2}`, acres: 0, made: 0, suffered: 0 };
    enemyCombined[key2].acres += e.acres || 0;
    enemyCombined[key2].made += e.made || 0;
    enemyCombined[key2].suffered += e.suffered || 0;
  }

  const displayEnemyEntries = Object.entries(enemyCombined).map(([k, v]) => ({ prov: v.prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
  displayEnemyEntries.sort((a, b) => (b.acres || 0) - (a.acres || 0));
  const enemyNet = displayEnemyEntries.reduce((s, e) => s + e.acres, 0);
  const enemyMadeCount = attacks.filter((a) => a.attackerKd === ENEMY_KD).length;
  const enemySufferedCount = attacks.filter((a) => a.defenderKd === ENEMY_KD).length;

  out.push('');
  out.push(`The Kingdom of ${ENEMY_KD}`);
  out.push(`Total Acres: ${enemyNet >= 0 ? `+${enemyNet}` : enemyNet} (${enemyMadeCount}/${enemySufferedCount})`);
  for (const e of displayEnemyEntries) {
    const m2 = (e.prov || '').toString().match(/^\s*(\d+)\s*-\s*(.*)$/);
    const name2 = m2 ? m2[2] : 'An unknown Province';
    out.push(`${e.acres} | ${name2} (${e.made}/${e.suffered})`);
  }

  return out.join('\n');
}

function detailedReportUI(attacks: ParsedAttack[], lines: string[]) {
  const focalKd = OUR_KD;

  const first = attacks[0];
  const last = attacks[attacks.length - 1];
  const timeWindowFrom = first?.date ?? "";
  const timeWindowTo = last?.date ?? "";

  const made = attacks.filter((a) => a.attackerKd === focalKd);
  const suffered = attacks.filter((a) => {
    if (a.defenderKd === focalKd) return true;
    const raw = (a.raw || "");
    if (raw.includes(`(${focalKd})`) && a.attackerKd !== focalKd) {
      const kdPattern = escapeRegExp(focalKd);
      const attackerPattern = new RegExp(`\\(\\s*${kdPattern}\\s*\\)\\s*(?:captured|invaded|attacked|attempted|set|sent)`, "i");
      const defenderPattern = new RegExp(`(?:captured|invaded|attacked|attempted|razed|recaptured|ambush|killed|looted|pillag)[\\s\\S]*\\(\\s*${kdPattern}\\s*\\)`, "i");
      if (defenderPattern.test(raw)) return true;
      if (!attackerPattern.test(raw) && /invaded|attacked|attempted|captured|razed|recaptured|ambush|killed|looted|pillag/i.test(raw)) return true;
    }
    return false;
  });

  const sum = (vals: Array<number | undefined>) => vals.reduce((acc: number, v) => acc + (v ?? 0), 0);

  const attackCategories = [
    "Traditional March",
    "Ambush",
    "Conquest",
    "Raze",
    "Massacre",
    "Plunder",
    "Failed Attack",
  ];

  function totalsFor(list: ParsedAttack[]) {
    const cats: any = {
      'Traditional March': { count: 0, acres: 0 },
      'Ambush': { count: 0, acres: 0 },
      'Conquest': { count: 0, acres: 0 },
      'Raze': { count: 0, acres: 0 },
      'Massacre': { count: 0, kills: 0 },
      'Plunder': { count: 0 },
      'Learn': { count: 0, books: 0 },
      'Failed Attack': { count: 0 },
    };
    for (const a of list) {
      const c = a.category || 'Other';
      if (!cats[c]) cats[c] = { count: 0, acres: 0 };
      cats[c].count += 1;
      if (a.acres) cats[c].acres = (cats[c].acres || 0) + a.acres;
      if (a.books) cats[c].books = (cats[c].books || 0) + a.books;
      if (a.kills) cats[c].kills = (cats[c].kills || 0) + a.kills;
    }
    const overallAcres = (cats['Traditional March'].acres || 0) + (cats['Ambush'].acres || 0) + (cats['Conquest'].acres || 0);
    const overallCount = Object.values(cats).reduce((s: number, v: any) => s + (v.count || 0), 0);
    const overallKills = Object.values(cats).reduce((s: number, v: any) => s + (v.kills || 0), 0);
    // uniques overridden below using windowed attacker-based counting
    return { totals: cats, overallCount, overallAcres, overallKills, uniques: 0 };
  }

  const madeStats = totalsFor(made);
  const sufStats = totalsFor(suffered);
  // will override uniques below with WINDOW-based per-province uniques

  // WINDOW uniques by attacker province (ambush excluded)
  const { total: uniqMadeCount, entries: uniqMadeEntries } = computeUniquesByAttacker(attacks, focalKd, UNIQUE_WINDOW_HOURS);
  // Suffered uniques: attackers (any kd) hitting focalKd, ambush excluded
  const sufLastByAttacker: Record<string, number> = {};
  const sufCountByAttacker: Record<string, number> = {};
  for (const a of attacks) {
    if (a.defenderKd === focalKd && a.category !== "Ambush") {
      const tick = (a as any)._tick || 0;
      const key = (normalizeProvKey(a.attackerProv) || a.attackerProv || 'An unknown Province').toString();
      const last = sufLastByAttacker[key];
      if (last === undefined || (tick - last) >= UNIQUE_WINDOW_HOURS) {
        sufCountByAttacker[key] = (sufCountByAttacker[key] || 0) + 1;
        sufLastByAttacker[key] = tick;
      }
    }
  }
  const uniqSufCount = Object.values(sufCountByAttacker).reduce((s, v) => s + v, 0);

  // surface uniques into summary stats so summary lines match breakdowns
  (madeStats as any).uniques = uniqMadeCount;
  (sufStats as any).uniques = uniqSufCount;

  // Derive non-attack counters (dragons, rituals, bounces summary)
  const eventStats = (() => {
    let dragonStartUs = 0;
    let dragonStartEnemy = 0;
    let dragonCompletedUs = 0;
    let dragonCompletedEnemy = 0;
    let enemyDragonsKilled = 0;
    let ritualsStartedUs = 0;
    let ritualsStartedEnemy = 0;
    let ritualsCompletedUs = 0;
    let ritualsCompletedEnemy = 0;

    for (const rawLine of lines) {
      const lower = rawLine.toLowerCase();
      const dragonProjectStart = /dragon project/.test(lower) && /(has begun|begun)/.test(lower);
      if (dragonProjectStart && /our kingdom/.test(lower)) dragonStartUs += 1;
      else if (dragonProjectStart && !/our kingdom/.test(lower)) dragonStartEnemy += 1;

      // Our dragon took flight toward the enemy
      if (
        /our dragon/.test(lower) &&
        /(sets flight|has set flight|has set .*flight|has completed our dragon)/.test(lower)
      ) {
        dragonCompletedUs += 1;
      }

      if (/slain the dragon|has slain.*dragon/.test(lower)) {
        enemyDragonsKilled += 1; // we killed an incoming dragon
        dragonCompletedEnemy += 1;
      }

      if (/ritual/.test(lower)) {
        if (/covering our lands/.test(lower)) {
          ritualsStartedEnemy += 1;
          ritualsCompletedEnemy += 1; // treat covering as enemy ritual active/completed for summary
        } else if (/started developing a ritual|begun developing a ritual/.test(lower)) {
          ritualsStartedUs += 1;
          ritualsCompletedUs += 1; // user wants it reflected as completed once started
        }
      }
    }

    const bouncesMade = attacks.filter((a) => a.category === "Failed Attack" && a.attackerKd === focalKd).length;
    const bouncesSuf = attacks.filter((a) => {
      if (a.category === "Failed Attack" && a.defenderKd === focalKd) return true;
      // fallback: if defender not parsed but raw shows our kd and an attempted/repelled phrase
      if (
        a.category === "Failed Attack" &&
        a.attackerKd !== focalKd &&
        !a.defenderKd &&
        /attempted|repelled/i.test(a.raw) &&
        a.raw.includes(`(${focalKd})`)
      ) return true;
      return false;
    }).length;

    return {
      bouncesMade,
      bouncesSuf,
      dragonStartUs,
      dragonStartEnemy,
      dragonCompletedUs,
      dragonCompletedEnemy,
      enemyDragonsKilled,
      ritualsStartedUs,
      ritualsStartedEnemy,
      ritualsCompletedUs,
      ritualsCompletedEnemy,
    };
  })();

  function provinceNetFor(kd: string) {
    const map: Record<string, { acres: number; made: number; suffered: number }> = {};
    const attackCats = new Set(['Traditional March','Ambush','Conquest','Raze','Massacre','Plunder','Failed Attack','Learn']);
    const attackLikeRegex = /invaded|attacked|captured|killed|looted|recaptured|razed|pillag|pillaged|ambush|massacre/i;
    for (const a of attacks) {
      // when kd is attacker, aggregate under the attacker province
      if (a.attackerKd === kd && a.attackerProv) {
        const raw = normalizeProvKey(a.attackerProv) || a.attackerProv;
        const k = raw as string;
        if (!map[k]) map[k] = { acres: 0, made: 0, suffered: 0 };
        const addAcres = (a.category === 'Raze') ? 0 : (a.acres || 0);
        if (addAcres) map[k].acres += addAcres;
        map[k].made += 1;
      }
      // when kd is defender, aggregate under the defender province
      if (a.defenderKd === kd && a.defenderProv) {
        const raw = normalizeProvKey(a.defenderProv) || a.defenderProv;
        const k = raw as string;
        if (!map[k]) map[k] = { acres: 0, made: 0, suffered: 0 };
        if (a.category === 'Raze') {
          // do not modify acres for raze
        } else if (a.acres) map[k].acres -= a.acres;
        map[k].suffered += 1;
      }
    }

    const entries = Object.entries(map).map(([prov, v]) => ({ prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
    const filtered = entries.filter((e) => {
      if (!e.prov || !e.prov.toString().trim()) return false;
      const p = e.prov.toString();
      if (/dragon|topaz|our kingdom|world divided/i.test(p)) return false;
      if (/^\s*-\s*/.test(p)) return false;
      return true;
    });

    const combined: Record<string, { prov: string; acres: number; made: number; suffered: number }> = {};
    for (const e of filtered) {
      const raw = (e.prov || "").toString();
      const m = raw.match(/^\s*(\d+)\s*-\s*(.*)$/);
      let id: string | null = null;
      let name: string;
      if (m) {
        id = m[1];
        name = m[2];
      } else if (/an unknown province/i.test(raw)) {
        id = "xxx";
        name = "An unknown Province";
      } else {
        id = "";
        name = raw.trim();
      }
      const key = `${id}|${name}`;
      if (!combined[key]) combined[key] = { prov: id ? `${id} - ${name}` : `${name}`, acres: 0, made: 0, suffered: 0 };
      combined[key].acres += e.acres || 0;
      combined[key].made += e.made || 0;
      combined[key].suffered += e.suffered || 0;
    }

    const out = Object.entries(combined).map(([k, v]) => ({ prov: v.prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
    out.sort((x, y) => (y.acres || 0) - (x.acres || 0));
    return out;
  }

  const focalProv = provinceNetFor(focalKd);
  const kdCounts: Record<string, number> = {};
  for (const a of attacks) {
    if (a.attackerKd) kdCounts[a.attackerKd] = (kdCounts[a.attackerKd] || 0) + 1;
    if (a.defenderKd) kdCounts[a.defenderKd] = (kdCounts[a.defenderKd] || 0) + 1;
  }
  const others = Object.keys(kdCounts).filter((k) => k !== focalKd);
  others.sort((a, b) => kdCounts[b] - kdCounts[a]);
  const otherKds = others;

  // Highlights and other rich UI sections
  let largestGain = { prov: "", acres: 0 };
  let largestLoss = { prov: "", acres: 0 };
  for (const a of attacks) {
    if (a.type === "land" && a.acres && a.attackerKd === focalKd) {
      if (a.acres > largestGain.acres) largestGain = { prov: a.defenderProv ?? "", acres: a.acres };
    }
    if (a.type === "land" && a.acres && a.defenderKd === focalKd) {
      if (a.acres > largestLoss.acres) largestLoss = { prov: a.defenderProv ?? "", acres: a.acres };
    }
  }

  const parseSimpleDateToTick = (s: string) => {
    const m = s.match(/^([A-Za-z]+)\s+(\d+)\s+of\s+YR(\d+)/i);
    if (!m) return null;
    const DAYS_PER_MONTH_LOCAL = 24;
    const DAYS_PER_CYCLE_LOCAL = 7 * DAYS_PER_MONTH_LOCAL;
    const monthName = m[1];
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    const monthShort = monthName.slice(0, 3).toLowerCase();
    const UT_SHORTS = ["jan", "feb", "mar", "apr", "may", "jun", "jul"];
    const monthIndex = UT_SHORTS.indexOf(monthShort);
    if (monthIndex === -1) return null;
    const zeroBased = year * DAYS_PER_CYCLE_LOCAL + monthIndex * DAYS_PER_MONTH_LOCAL + (day - 1);
    return zeroBased + 1;
  };

  const dfTick = parseSimpleDateToTick(timeWindowFrom);
  const dtTick = parseSimpleDateToTick(timeWindowTo);
  let hoursText = "N/A";
  if (dfTick != null && dtTick != null) {
    const tickDiff = Math.abs(dtTick - dfTick);
    hoursText = `${tickDiff+1} hours`;
  }

  const header = `** Kingdom news report **\nFor the time from ${timeWindowFrom} till ${timeWindowTo} - ${hoursText}`;

  const bodyLines: string[] = [];
  bodyLines.push("");
  bodyLines.push("** Summary **");
  bodyLines.push(`Total attacks made (${focalKd}): ${madeStats.overallCount} (${madeStats.overallAcres} acres)`);
  bodyLines.push(`-- Traditional march: ${madeStats.totals["Traditional March"].count} (${madeStats.totals["Traditional March"].acres} acres)`);
  bodyLines.push(`-- Ambush: ${madeStats.totals["Ambush"].count} (${madeStats.totals["Ambush"].acres} acres)`);
  bodyLines.push(`-- Conquest: ${madeStats.totals["Conquest"].count} (${madeStats.totals["Conquest"].acres} acres)`);
  bodyLines.push(`-- Raze: ${madeStats.totals["Raze"].count} (${madeStats.totals["Raze"].acres} acres)`);
  bodyLines.push(`-- Massacre: ${madeStats.totals["Massacre"].count} (${madeStats.totals["Massacre"].kills} population)`);
  bodyLines.push(`-- Plunder: ${madeStats.totals["Plunder"].count}`);
  const failRateMade = madeStats.overallCount ? ((madeStats.totals["Failed Attack"].count / madeStats.overallCount) * 100).toFixed(1) : "0.0";
  bodyLines.push(`-- Failed: ${madeStats.totals["Failed Attack"].count} (${failRateMade}% failure)`);
  bodyLines.push(`-- Uniques: ${madeStats.uniques}`);
  bodyLines.push(`-- Bounces: ${eventStats.bouncesMade}`);
  bodyLines.push(`-- DragonsStarted: ${eventStats.dragonStartUs}`);
  bodyLines.push(`-- DragonsCompleted: ${eventStats.dragonCompletedUs}`);
  bodyLines.push(`-- Enemy Dragons Killed: ${eventStats.enemyDragonsKilled}`);
  bodyLines.push(`-- Rituals Started: ${eventStats.ritualsStartedUs}`);
  bodyLines.push(`-- Rituals Completed: ${eventStats.ritualsCompletedUs}`);
  bodyLines.push(`\nTotal attacks suffered (${focalKd}): ${sufStats.overallCount} (${sufStats.overallAcres} acres)`);
  bodyLines.push(`-- Traditional march: ${sufStats.totals["Traditional March"].count} (${sufStats.totals["Traditional March"].acres} acres)`);
  bodyLines.push(`-- Ambush: ${sufStats.totals["Ambush"].count} (${sufStats.totals["Ambush"].acres} acres)`);
  bodyLines.push(`-- Raze: ${sufStats.totals["Raze"].count} (${sufStats.totals["Raze"].acres} acres)`);
  bodyLines.push(`-- Massacre: ${sufStats.totals["Massacre"].count} (${sufStats.totals["Massacre"].kills} population)`);
  const failRateSuf = sufStats.overallCount ? ((sufStats.totals["Failed Attack"].count / sufStats.overallCount) * 100).toFixed(1) : "0.0";
  bodyLines.push(`-- Failed: ${sufStats.totals["Failed Attack"].count} (${failRateSuf}% failure)`);
  bodyLines.push(`-- Uniques: ${sufStats.uniques}`);
  bodyLines.push(`-- Bounces: ${eventStats.bouncesSuf}`);
  bodyLines.push(`-- Dragons Started: ${eventStats.dragonStartEnemy}`);
  bodyLines.push(`-- Dragons Completed: ${eventStats.dragonCompletedEnemy}`);
  bodyLines.push(`\n`);

  function formatKingdomSection(kd: string, entries: { prov: string; acres: number; times: number; made?: number; suffered?: number }[]) {
    const display = entries.filter((e) => {
      if (!e.prov || !e.prov.toString().trim()) return false;
      const p = e.prov.toString();
      if (/dragon|topaz|our kingdom|world divided/i.test(p)) return false;
      if (/^\s*-\s*/.test(p)) return false;
      return true;
    });
    const net = display.reduce((acc, e) => acc + e.acres, 0);
    const totalMade = attacks.filter((a) => a.attackerKd === kd && COUNT_CATEGORIES.has(a.category || '')).length;
    const totalSuffered = attacks.filter((a) => a.defenderKd === kd && COUNT_CATEGORIES.has(a.category || '')).length;
    const header = `** The kingdom of ${kd} **`;
    const lines = [header, `Total Acres: ${net >= 0 ? `+${net}` : net} (${totalMade}/${totalSuffered})`];
    for (const e of display) {
      const provStr = (e.prov || "").toString();
      const m = provStr.match(/^\s*(\d+)\s*-\s*(.*)$/);
      const sign = e.acres >= 0 ? `${e.acres}` : `${e.acres}`;
      const made = e.made ?? 0;
      const suffered = e.suffered ?? 0;
      if (m) {
        const id = m[1];
        const name = m[2];
        lines.push(`${sign} | ${id} - ${name} (${made}/${suffered})`);
      } else if (/an unknown province/i.test(provStr)) {
        lines.push(`${sign} | An unknown Province (${made}/${suffered})`);
      } else {
        lines.push(`${sign} | ${provStr} (${made}/${suffered})`);
      }
    }
    return lines;
  }

  bodyLines.push(...formatKingdomSection(focalKd, focalProv));
  bodyLines.push("");
  for (const kd of otherKds) {
    bodyLines.push(...formatKingdomSection(kd, provinceNetFor(kd)));
    bodyLines.push("");
  }

  // 5-hour unique breakdown per kingdom (attacker provinces only, ambush excluded)
  const computeUniquesEntriesForKd = (kd: string) => {
    const lastByProv: Record<string, number> = {};
    const countByProv: Record<string, number> = {};
    for (const a of attacks) {
      if (a.attackerKd !== kd) continue;
      if (a.category === "Ambush") continue;
      const tick = (a as any)._tick || 0;
      const key = (normalizeProvKey(a.attackerProv) || a.attackerProv || 'An unknown Province').toString();
      const last = lastByProv[key];
      if (last === undefined || (tick - last) >= UNIQUE_WINDOW_HOURS) {
        countByProv[key] = (countByProv[key] || 0) + 1;
        lastByProv[key] = tick;
      }
    }
    return Object.entries(countByProv).sort((a, b) => b[1] - a[1]);
  };

  const uniquesForUs = computeUniquesEntriesForKd(focalKd);
  const uniquesForUsTotal = uniquesForUs.reduce((s, [, v]) => s + v, 0);
  (madeStats as any).uniques = uniquesForUsTotal;

  bodyLines.push("");
  bodyLines.push("** Uniques for " + focalKd + " **");
  for (const [prov, cnt] of uniquesForUs) {
    bodyLines.push(`${prov} - ${cnt}`);
  }

  const enemyKd = otherKds[0] || ENEMY_KD;
  const uniquesForEnemy = computeUniquesEntriesForKd(enemyKd);
  const uniquesForEnemyTotal = uniquesForEnemy.reduce((s, [, v]) => s + v, 0);
  (sufStats as any).uniques = uniquesForEnemyTotal;

  if (uniquesForEnemy.length > 0) {
    bodyLines.push("");
    bodyLines.push("** Uniques for " + enemyKd + " **");
    for (const [prov, cnt] of uniquesForEnemy) {
      bodyLines.push(`${prov} - ${cnt}`);
    }
  }

  bodyLines.push("");
  bodyLines.push("** Highlights **");

  const tradMade = attacks.filter((a) => a.type === "land" && a.attackerKd === focalKd && a.acres);
  const tradLost = attacks.filter((a) => a.type === "land" && a.defenderKd === focalKd && a.acres);

  if (tradMade.length > 0) {
    const most = tradMade.reduce((p, c) => (c.acres! > p.acres! ? c : p));
    bodyLines.push("Most land gained in a single tradmarch");
    bodyLines.push(`${most.date ? most.date + "\t" : ""}${most.attackerProv ?? most.attackerKd}: ${most.acres} acres.`);
    bodyLines.push("");
  }

  if (tradLost.length > 0) {
    const mostLost = tradLost.reduce((p, c) => (c.acres! > p.acres! ? c : p));
    bodyLines.push("Most land lost in a single tradmarch");
    bodyLines.push(`${mostLost.date ? mostLost.date + "\t" : ""}${mostLost.defenderProv ?? mostLost.defenderKd}: ${mostLost.acres} acres.`);
    bodyLines.push("");
  }

  if (tradMade.length > 0) {
    const least = tradMade.reduce((p, c) => (c.acres! < p.acres! ? c : p));
    bodyLines.push("Least land gained in a single tradmarch");
    bodyLines.push(`${least.date ? least.date + "\t" : ""}${least.attackerProv ?? least.attackerKd}: ${least.acres} acres.`);
    bodyLines.push("");
  }

  if (tradLost.length > 0) {
    const leastLost = tradLost.reduce((p, c) => (c.acres! < p.acres! ? c : p));
    bodyLines.push("Least land lost in a single tradmarch");
    bodyLines.push(`${leastLost.date ? leastLost.date + "\t" : ""}${leastLost.defenderProv ?? leastLost.defenderKd}: ${leastLost.acres} acres.`);
    bodyLines.push("");
  }

  const ambMade = attacks.filter((a) => a.category === "Ambush" && a.attackerKd === focalKd && a.acres);
  const ambSuf = attacks.filter((a) => a.category === "Ambush" && a.defenderKd === focalKd && a.acres);
  if (ambMade.length > 0) {
    const mostRegained = ambMade.reduce((p, c) => (c.acres! > p.acres! ? c : p));
    bodyLines.push("Most land regained in a single ambush");
    bodyLines.push(`${mostRegained.date ? mostRegained.date + "\t" : ""}${mostRegained.attackerProv ?? "An unknown province"}: ${mostRegained.acres} acres.`);
    bodyLines.push("");
    const leastRegained = ambMade.reduce((p, c) => (c.acres! < p.acres! ? c : p));
    bodyLines.push("Least land regained in a single ambush");
    bodyLines.push(`${leastRegained.date ? leastRegained.date + "\t" : ""}${leastRegained.attackerProv ?? "An unknown province"}: ${leastRegained.acres} acres.`);
    bodyLines.push("");
  }
  if (ambSuf.length > 0) {
    const mostLostAmb = ambSuf.reduce((p, c) => (c.acres! > p.acres! ? c : p));
    bodyLines.push("Most land lost in a single ambush");
    bodyLines.push(`${mostLostAmb.date ? mostLostAmb.date + "\t" : ""}${mostLostAmb.attackerProv ?? "An unknown province"} from ${mostLostAmb.attackerKd ?? "Unknown KD"}: ${mostLostAmb.acres} acres.`);
    bodyLines.push("");
    const leastLostAmb = ambSuf.reduce((p, c) => (c.acres! < p.acres! ? c : p));
    bodyLines.push("Least land lost in a single ambush");
    bodyLines.push(`${leastLostAmb.date ? leastLostAmb.date + "\t" : ""}${leastLostAmb.attackerProv ?? "An unknown province"} from ${leastLostAmb.attackerKd ?? "Unknown KD"}: ${leastLostAmb.acres} acres.`);
    bodyLines.push("");
  }

  const failMade = attacks.filter((a) => a.category === "Failed Attack" && a.attackerKd === focalKd);
  const failRec = attacks.filter((a) => a.category === "Failed Attack" && a.defenderKd === focalKd);
  const madeMap: Record<string, { count: number; dates: string[]; kd?: string }> = {};
  for (const f of failMade) {
    const key = f.attackerProv ?? f.attackerKd ?? "An unknown province";
    if (!madeMap[key]) madeMap[key] = { count: 0, dates: [], kd: f.attackerKd };
    madeMap[key].count += 1;
    if (f.date) madeMap[key].dates.push(f.date);
  }
  const recMap: Record<string, { count: number; dates: string[]; kd?: string }> = {};
  for (const f of failRec) {
    const key = f.attackerProv ?? f.attackerKd ?? "An unknown province";
    if (!recMap[key]) recMap[key] = { count: 0, dates: [], kd: f.attackerKd };
    recMap[key].count += 1;
    if (f.date) recMap[key].dates.push(f.date);
  }
  const madeEntries = Object.entries(madeMap).sort((a, b) => b[1].count - a[1].count);
  const recEntries = Object.entries(recMap).sort((a, b) => b[1].count - a[1].count);
  if (madeEntries.length > 0) {
    const max = madeEntries[0][1].count;
    const tops = madeEntries.filter(([, v]) => v.count === max).map(([k, v]) => `${v.dates.length ? v.dates.join(', ') + '\t' : ''}${k}`);
    bodyLines.push("Most bounces made by");
    bodyLines.push(`${tops.join(", ")}: ${max} times.`);
    bodyLines.push("");
  }
  if (recEntries.length > 0) {
    const maxR = recEntries[0][1].count;
    const topsR = recEntries.filter(([, v]) => v.count === maxR).map(([k, v]) => `${v.dates.length ? v.dates.join(', ') + '\t' : ''}${k}`);
    bodyLines.push("Most bounces received by");
    bodyLines.push(`${topsR.join(", ")}: ${maxR} times.`);
    bodyLines.push("");
  }

  bodyLines.push("");
  bodyLines.push("** Relations News **");
  const relationRegex = /\b(declared\s+WAR|has\s+declared\s+WAR|we\s+have\s+declared\s+WAR|withdrawn\s+from\s+war|has\s+withdrawn|withdraw\s+from\s+war|surrender|has\s+withdrawn\s+from|Mutual\s+Peace|proposed\s+a\s+Mutual\s+Peace|accepted\s+an\s+offer|accepted\s+our\s+ceasefire|entered\s+into\s+a\s+formal\s+ceasefire|post-?war|post war|post-war|ceasefire|withdrew|terminated|broken)\b/i;
  const relationEventsRaw = lines.filter((l) => relationRegex.test(l));
  if (relationEventsRaw.length === 0) {
    bodyLines.push("No relation events detected.");
  } else {
    for (const rawLine of relationEventsRaw) {
      const m = rawLine.match(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)/i);
      const datePrefix = m ? m[1] + "\t" : "";
      const text = rawLine.replace(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)\s*/i, "").replace(/\s+/g, " ").trim();
      bodyLines.push(`${datePrefix}${text}`);
    }
  }

  bodyLines.push("");
  bodyLines.push("** Dragon News **");
  const dragonLines = lines.filter((l) => /dragon/i.test(l));
  if (dragonLines.length === 0) {
    bodyLines.push("No dragon events detected.");
  } else {
    const cancellation: string[] = [];
    const enemyCancellation: string[] = [];
    const starting: string[] = [];
    const enemyStarting: string[] = [];
    const sendingObjs: Array<{ date?: string; name?: string; kd?: string }> = [];
    const receivingObjs: Array<{ date?: string; type?: string; name?: string; kd?: string }> = [];
    const slaying: string[] = [];
    const fliesAway: string[] = [];
    for (const rawLine of dragonLines) {
      const m = rawLine.match(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)/i);
      const date = m ? m[1] : undefined;
      const text = rawLine.replace(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)\s*/i, "").replace(/\s+/g, " ").trim();
      const lower = text.toLowerCase();
      if (/cancelled|canceled/.test(lower) && /targeted at us|targeted at our|targeted at us\b/.test(lower)) {
        enemyCancellation.push(`${date ? date + "\t" : ""}${text}`);
      } else if (/cancelled|canceled/.test(lower)) {
        cancellation.push(`${date ? date + "\t" : ""}${text}`);
      } else if (/begun the .*dragon|begun a .*dragon project|has begun a .*dragon|has begun the .*dragon/i.test(text)) {
        if (/^kingdom\(/i.test(text) || /^[A-Z0-9].*\(\d+:\d+\)/.test(text)) {
          enemyStarting.push(`${date ? date + "\t" : ""}${text}`);
        } else {
          starting.push(`${date ? date + "\t" : ""}${text}`);
        }
      } else if (/set flight|set sail|set.*flight|has set flight to ravage|sending a dragon|sending.*dragon/i.test(lower)) {
        const nameMatch = text.match(/Our\s+dragon,?\s*([^,]+),/i);
        const kdMatch = text.match(/([A-Za-z0-9 \-']+)\s*\((\d+:\d+)\)/);
        sendingObjs.push({ date, name: nameMatch?.[1]?.trim(), kd: kdMatch?.[2] ?? undefined });
      } else if (/\bslain\b|\bhas\s+slain\b|\bhas\s+been\s+slain\b|\bslays\b|\bhas\s+slay(ed)?\b/.test(lower)) {
        slaying.push(`${date ? date + "\t" : ""}${text}`);
      } else if (/(?:has\s+begun\s+(?:ravaging|to\s+ravage)|began\s+ravaging|ravaging\s+our|has\s+begun\s+to\s+ravage|has\s+started\s+ravaging)/i.test(text) && !/\bslain\b|\bhas\s+slain\b|\bslays\b/i.test(lower)) {
        const recvMatch = text.match(/A\s+([A-Za-z0-9]+)\s+Dragon,?\s*([^,]+),?\s*from\s+([A-Za-z0-9 \-']+\s*\(\d+:\d+\))/i);
        if (recvMatch) {
          const type = recvMatch[1]?.trim();
          const name = recvMatch[2]?.trim();
          const kdMatch = recvMatch[3]?.match(/\((\d+:\d+)\)/);
          receivingObjs.push({ date, type, name, kd: kdMatch ? kdMatch[1] : undefined });
        } else {
          const typeMatch = text.match(/A\s+([A-Za-z0-9]+)\s+Dragon/i);
          const nameMatch = text.match(/Dragon,?\s*([^,]+),?\s*from/i);
          const kdMatch = text.match(/\((\d+:\d+)\)/);
          receivingObjs.push({ date, type: typeMatch?.[1]?.trim(), name: nameMatch?.[1]?.trim(), kd: kdMatch?.[1] });
        }
      } else if (/flown away|flies away|has flown away|has flown off|flown off/.test(lower)) {
        fliesAway.push(`${date ? date + "\t" : ""}${text}`);
      } else {
        if (/project|dragon project|begun|started/.test(lower)) starting.push(`${date ? date + "\t" : ""}${text}`);
        else bodyLines.push(`${date ? date + "\t" : ""}${text}`);
      }
    }

    bodyLines.push(`Dragon Sent: ${sendingObjs.length}`);
    const recvTotal = receivingObjs.length;
    const recvMap: Record<string, number> = {};
    for (const r of receivingObjs) { const key = r.type ?? r.name ?? "Unknown"; recvMap[key] = (recvMap[key] || 0) + 1; }
    const breakdown = Object.entries(recvMap).map(([k, v]) => `${k}(${v})`).join(" ");
    bodyLines.push(`Dragon Received: ${recvTotal}${recvTotal > 0 ? `, ${breakdown}` : ""}`);
    bodyLines.push("");
    if (slaying.length) { bodyLines.push("Dragon Slain:"); bodyLines.push(...slaying); bodyLines.push(""); }
    if (fliesAway.length) { bodyLines.push("Dragon Flies Away:"); bodyLines.push(...fliesAway); bodyLines.push(""); }
  }

  return `${header}\n${bodyLines.join("\n")}`;
}
function parseLineToAttack(line: string): ParsedAttack | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Date-only lines like "May 8 of YR3" (only skip if the whole line is the date)
  if (/^[A-Za-z]+\s+\d+\s+of\s+YR\d+$/i.test(trimmed)) {
    return null;
  }

  // strip a leading date prefix (e.g. "July 13 of YR3\t") so parsing targets the province text
  const content = trimmed.replace(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+\s*\t?)/i, "").trim();

  const isInvaded = /invaded/i.test(content);
  const isAttacked = /attacked/i.test(content);
  const isLooted = /looted/i.test(content);
  const isCaptured = /captured/i.test(content);
  const isRazed = /razed/i.test(content);
  const isKilled = /killed/i.test(content);
  const isAmbush = /\bambush|\bambushed/i.test(content);
  const isAttempted = /attempted to invade|attempted an invasion|attempted to invade/i.test(content);
  const isRecaptured = /recaptured/i.test(content);
  const isPillaged = /pillag|pillaged/i.test(content);
  const isConquestStyle = /^.*?,\s*captured\s+\d+/i.test(content); // "Province(...), captured 123 acres"
  const isDragon = /dragon project|Dragon project|begun the .*Dragon|has begun the .*Dragon/i.test(content);
  const isWar = /declared\s+WAR|has declared WAR|we have declared WAR|has declared WAR/i.test(content);
  const isCeasefire = /ceasefire/i.test(content);
  const isProposal = /proposed|proposal/i.test(content);
  const isAid = /aid shipment|sent an aid shipment|has sent an aid/i.test(content);
  const isDefect = /defected/i.test(content);
  const isCollapse = /collapsed|lies in ruins|has collapsed/i.test(content);

  const hasCombat =
    isInvaded ||
    isAttacked ||
    isLooted ||
    isCaptured ||
    isRazed ||
    isKilled ||
    isAttempted ||
    isRecaptured ||
    isPillaged ||
    isAmbush;

  if (!hasCombat) return null;

  const dateMatch = trimmed.match(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)/i);
  const date = dateMatch ? dateMatch[1] : "";

  // 1) strip Markdown link URLs, keep the text + coords (operate on date-stripped content):
  //    "([3:12](https://...))" -> "([3:12])"
  const cleaned = content.replace(/\(\[(\d+:\d+)\]\([^)]*\)\)/g, "([$1])");

  // attacker: "X ([3:12])" or "X (3:12)"
  let attackerProv: string | undefined;
  let attackerKd: string | undefined;
  let defenderProv: string | undefined;
  let defenderKd: string | undefined;

  // Prefer explicit patterns where attacker captured X acres from defender
  let explicitMatched = false;

  // If it's an unknown province from a kingdom, record attacker kd from the line
  const unknownOwnMatch = cleaned.match(/^An unknown province from\s+(.*?)\s*\((\d+:\d+)\)/i);
  if (unknownOwnMatch) {
    attackerProv = "An unknown Province";
    attackerKd = unknownOwnMatch[2];
    explicitMatched = true;
  }
  // Special-case lines like "An unknown province from X (KD) recaptured 123 acres of land from Y (KD)"
  const unknownAttackerMatch = cleaned.match(/^An unknown province from\s+(.*?)\s*\((\d+:\d+)\)\s*(?:recaptured|captured|invaded|attacked)[\s\S]*?[\d,]+\s+acres[\s\S]*?\bfrom\s+(.*?)\s*\((\d+:\d+)\)/i);
  if (unknownAttackerMatch) {
    attackerProv = `An unknown province from ${unknownAttackerMatch[1].trim()}`;
    attackerKd = unknownAttackerMatch[2];
    defenderProv = unknownAttackerMatch[3].trim().replace(/-\s*$/, "");
    defenderKd = unknownAttackerMatch[4];
    explicitMatched = true;
  }

  const capFromMatch = cleaned.match(/^(.*?)\s*\((\d+:\d+)\)\s*(?:captured|invaded|attacked)[\s\S]*?([\d,]+)\s+acres[\s\S]*?\bfrom\s+(.*?)\s*\((\d+:\d+)\)/i);
  if (capFromMatch) {
    attackerProv = capFromMatch[1].trim().replace(/-\s*$/, "").trim();
    attackerKd = capFromMatch[2];
    const acresVal = parseInt(capFromMatch[3].replace(/,/g, ""), 10);
    defenderProv = capFromMatch[4].trim().replace(/-\s*$/, "").trim();
    defenderKd = capFromMatch[5];
    explicitMatched = true;
  } else {
    // pattern: ATTACKER (kd) invaded DEFENDER (kd) and captured N acres
    const invadedMatch = cleaned.match(/^(.*?)\s*\((\d+:\d+)\)\s*invaded\s+(.*?)\s*\((\d+:\d+)\)[\s\S]*?captured\s+([\d,]+)\s+acres/i);
    if (invadedMatch) {
      attackerProv = invadedMatch[1].trim().replace(/-\s*$/, "").trim();
      attackerKd = invadedMatch[2];
      defenderProv = invadedMatch[3].trim().replace(/-\s*$/, "").trim();
      defenderKd = invadedMatch[4];
      explicitMatched = true;
    }
  }

  // Fallback: simple leading attacker and 'from'/'invaded' defender matches
  if (!explicitMatched) {
    const attackerMatch = cleaned.match(/^(.*?)\(\[(\d+:\d+)\]\)/) || cleaned.match(/^(.*?)\((\d+:\d+)\)/);
    if (attackerMatch) {
      attackerProv = attackerMatch[1].trim().replace(/-\s*$/, "").trim();
      attackerKd = attackerMatch[2];
    }
    const defenderMatch =
      cleaned.match(/from\s+(.*?)\(\[(\d+:\d+)\]\)/) ||
      cleaned.match(/from\s+(.*?)\((\d+:\d+)\)/) ||
      cleaned.match(/invaded\s+(.*?)\(\[(\d+:\d+)\]\)/) ||
      cleaned.match(/invaded\s+(.*?)\((\d+:\d+)\)/) ||
      cleaned.match(/attempted\s+to\s+invade\s+(.*?)\(\[(\d+:\d+)\]\)/) ||
      cleaned.match(/attempted\s+to\s+invade\s+(.*?)\((\d+:\d+)\)/);
    if (defenderMatch) {
      defenderProv = defenderMatch[1].trim().replace(/-\s*$/, "").trim();
      defenderKd = defenderMatch[2];
    }
  }

  let type: ParsedAttackType = "other";
  if (isAttempted) type = "fail";
  else if (isRazed) type = "raze";
  else if (isLooted && !isCaptured) type = "plunder";
  else if (isAmbush && isCaptured) type = "land";
  else if (isCaptured && !isRazed) type = "land";
  else if (isKilled && !isCaptured && !isRazed) type = "massacre";
  else if (isInvaded || isAttacked || isRecaptured || isPillaged || isAmbush) {
    if (isKilled && !isCaptured && !isRazed) type = "massacre";
    else if (isCaptured || isAmbush) type = "land";
    else type = "other";
  }

  // high-level category labels following user's format guidance
  let category: string | undefined;
  if (isCollapse) category = "Killed";
  else if (isDefect) category = /defected to us/i.test(content) ? "Defected in" : "Defected out";
  else if (isAid) category = "Aid";
  else if (isDragon) category = /has begun|begun the/i.test(content) ? "Starting a Dragon" : "Dragon Update";
  else if (isWar) category = /we have declared|we have declared WAR/i.test(content) ? "War Declaration" : "Enemy Declaration";
  else if (isCeasefire) category = /withdraw|withdrew/i.test(content) ? "Withdrew Proposal" : "Ceasefire";
  else if (isRecaptured) category = "Ambush";
  else if (isAmbush) category = "Ambush";
  else if (isPillaged) category = "Plunder";
  else if (isLooted) category = "Learn";
  else if (isRazed) category = "Raze";
  else if (isCaptured && isConquestStyle) category = "Conquest";
  else if (isCaptured) category = "Traditional March";
  else if (isKilled) category = "Massacre";
  else if (isAttempted) category = "Failed Attack";
  else category = "Other";

  let acres: number | undefined;
  let books: number | undefined;
  let kills: number | undefined;

  const acresMatch = cleaned.match(/(\d[\d,]*)\s+acres/);
  if (acresMatch) acres = parseInt(acresMatch[1].replace(/,/g, ""), 10);

  const booksMatch = cleaned.match(/(\d[\d,]*)\s+books/);
  if (booksMatch) books = parseInt(booksMatch[1].replace(/,/g, ""), 10);

  const killsMatch = cleaned.match(/killed\s+(\d[\d,]*)\s+people/);
  if (killsMatch) kills = parseInt(killsMatch[1].replace(/,/g, ""), 10);

  return {
    raw: trimmed,
    date,
    attackerProv,
    attackerKd,
    defenderProv,
    defenderKd,
    type,
    category,
    acres,
    books,
    kills,
    isOutgoing: false,
  };
}


function summarize(attacks: ParsedAttack[]): SummaryResult {
  const first = attacks[0];
  const last = attacks[attacks.length - 1];

  const timeWindow = {
    from: first?.date ?? "",
    to: last?.date ?? "",
  };

  const made = attacks.filter((a) => a.isOutgoing);
  const suffered = attacks.filter((a) => !a.isOutgoing);

  const sum = (vals: Array<number | undefined>): number =>
    vals.reduce((acc: number, v) => acc + (v ?? 0), 0);

  const totalMade = made.length;
  const totalSuffered = suffered.length;

  const landMade = made.filter((a) => a.type === "land");
  const landSuffered = suffered.filter((a) => a.type === "land");

  const plunderMade = made.filter((a) => a.type === "plunder");
  const plunderSuffered = suffered.filter((a) => a.type === "plunder");

  const razeMade = made.filter((a) => a.type === "raze");
  const razeSuffered = suffered.filter((a) => a.type === "raze");

  const massacreMade = made.filter((a) => a.type === "massacre");
  const massacreSuffered = suffered.filter((a) => a.type === "massacre");

  const failMade = made.filter((a) => a.type === "fail");
  const failSuffered = suffered.filter((a) => a.type === "fail");

  const uniquesMade = new Set(
    made.map((a) => a.attackerProv).filter(Boolean)
  ).size;
  const uniquesSuffered = new Set(
    suffered.map((a) => a.defenderProv).filter(Boolean)
  ).size;

  const madeTotals: SummaryTotalsSide = {
    count: totalMade,
    landCount: landMade.length,
    landAcres: sum(landMade.map((a) => a.acres)),
    plunderCount: plunderMade.length,
    plunderBooks: sum(plunderMade.map((a) => a.books)),
    razeCount: razeMade.length,
    razeAcres: sum(razeMade.map((a) => a.acres)),
    massacreCount: massacreMade.length,
    massacreKills: sum(massacreMade.map((a) => a.kills)),
    failCount: failMade.length,
    uniques: uniquesMade,
  };

  const sufferedTotals: SummaryTotalsSide = {
    count: totalSuffered,
    landCount: landSuffered.length,
    landAcres: sum(landSuffered.map((a) => a.acres)),
    plunderCount: plunderSuffered.length,
    plunderBooks: sum(plunderSuffered.map((a) => a.books)),
    razeCount: razeSuffered.length,
    razeAcres: sum(razeSuffered.map((a) => a.acres)),
    massacreCount: massacreSuffered.length,
    massacreKills: sum(massacreSuffered.map((a) => a.kills)),
    failCount: failSuffered.length,
    uniques: uniquesSuffered,
  };

  return {
    timeWindow,
    totals: {
      made: madeTotals,
      suffered: sufferedTotals,
    },
  };
}

const Next15: React.FC = () => {
  const [input, setInput] = useState<string>("");
  const [report, setReport] = useState<string>("");
  const [provJson, setProvJson] = useState<any>(null);
  const [provLog, setProvLog] = useState<string[]>([]);
  const [mode, setMode] = useState<'kingdom'|'province'>('kingdom');
  const [ourKdInput, setOurKdInput] = useState<string>("");
  const [enemyKdInput, setEnemyKdInput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const handleGenerate = () => {
    if (mode === 'province') {
      const { text, log, formatted, json } = parseProvinceNews(input);
      // Store structured outputs for UI and show the concise formatted summary
      setProvJson(json || null);
      setProvLog(log || []);
      setReport(formatted || text || "");
      return;
    }
    const rawLines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const sortedEntries = rawLines
      .map((line, idx) => ({ line, idx, tick: parseTickFromLine(line) ?? Number.POSITIVE_INFINITY }))
      .sort((a, b) => (a.tick === b.tick ? a.idx - b.idx : a.tick - b.tick));

    const parsedAttacks: ParsedAttack[] = [];
    let lastTick = 0; // monotonic hour-like counter
    const perDateSeq: Record<number, number> = {};
    const kdOrder: Record<string, number> = {};
    let kdIndex = 0;
    const noteKd = (kd?: string) => {
      if (!kd) return;
      if (kdOrder[kd] === undefined) {
        kdOrder[kd] = kdIndex++;
      }
    };
    for (const entry of sortedEntries) {
      const parsed = parseLineToAttack(entry.line);
      if (parsed) {
        let tickVal: number;
        if (Number.isFinite(entry.tick)) {
          const baseHours = (entry.tick as number) * 24; // convert day tick to hour scale
          const seq = (perDateSeq[entry.tick as number] = (perDateSeq[entry.tick as number] || 0) + 1);
          tickVal = baseHours + (seq - 1);
        } else {
          tickVal = lastTick + 1; // fallback strictly increasing
        }
        lastTick = tickVal;
        (parsed as any)._tick = tickVal;
        noteKd(parsed.attackerKd);
        noteKd(parsed.defenderKd);
        parsedAttacks.push(parsed);
      }
    }

    // Infer kingdoms from parsed data if inputs are blank
    const kdCounts: Record<string, { atk: number; def: number; total: number }> = {};
    for (const a of parsedAttacks) {
      if (a.attackerKd) {
        const k = a.attackerKd;
        kdCounts[k] = kdCounts[k] || { atk: 0, def: 0, total: 0 };
        kdCounts[k].atk += 1; kdCounts[k].total += 1;
      }
      if (a.defenderKd) {
        const k = a.defenderKd;
        kdCounts[k] = kdCounts[k] || { atk: 0, def: 0, total: 0 };
        kdCounts[k].def += 1; kdCounts[k].total += 1;
      }
    }
    const kdEntries = Object.entries(kdCounts).sort((a, b) => {
      if (b[1].def !== a[1].def) return b[1].def - a[1].def; // prefer who got hit most as our kd
      if (b[1].total !== a[1].total) return b[1].total - a[1].total;
      if (b[1].atk !== a[1].atk) return b[1].atk - a[1].atk;
      const ao = kdOrder[a[0]] ?? Number.MAX_SAFE_INTEGER;
      const bo = kdOrder[b[0]] ?? Number.MAX_SAFE_INTEGER;
      return ao - bo;
    });

    const explicitEnemy = inferEnemyKdFromLines(rawLines);
    const explicitOur = inferOurKdFromLines(rawLines);
    const inferredOur = explicitOur || kdEntries.find(([k]) => k !== explicitEnemy)?.[0];
    const inferredEnemy = explicitEnemy || kdEntries.find(([k]) => k !== inferredOur)?.[0];

    const ourInput = (ourKdInput || "").trim();
    const enemyInput = (enemyKdInput || "").trim();

    OUR_KD = ourInput || inferredOur || "3:12";
    ENEMY_KD = enemyInput || inferredEnemy || "6:7";

    // Recompute isOutgoing and drop duplicate outgoing lines now that OUR_KD is set
    const attacks: ParsedAttack[] = [];
    const seenOutgoing = new Set<string>();
    for (const a of parsedAttacks) {
      a.isOutgoing = a.attackerKd === OUR_KD;
      if (a.isOutgoing) {
        if (seenOutgoing.has(a.raw)) continue;
        seenOutgoing.add(a.raw);
      }
      attacks.push(a);
    }

    if (attacks.length === 0) {
      setReport("No attacks detected in pasted text.");
      return;
    }
    // Build the UI-style report (original Next15 format)
    const out = detailedReportUI(attacks, rawLines);
    setReport(out);
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Utopia News Formatter</h2>
      <p className={styles.description}>Paste news log to generate a formatted summary.</p>
      <div style={{ marginBottom: 10 }}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${mode === 'kingdom' ? styles.tabActive : ''}`}
            onClick={() => setMode('kingdom')}
          >
            Kingdom Formatter
          </button>
          <button
            type="button"
            className={`${styles.tab} ${mode === 'province' ? styles.tabActive : ''}`}
            onClick={() => setMode('province')}
          >
            Province Formatter
          </button>
        </div>
      </div>
      <textarea
        className={styles.textarea}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={18}
        placeholder="Paste news log here…"
      />
      <button onClick={handleGenerate} className={styles.button}>
        Generate report
      </button>
      {report && (
        <div>
          <div className={styles.reportToolbar}>
            <div className={styles.reportHeader}>
              <strong>Formatted Formatted Report</strong>
              <span className={styles.smallMuted} style={{ marginLeft: 8 }}> - by Infinity</span>
            </div>
            <div>
              <button
                className={`${styles.copyButton} ${copied ? 'copied' : ''}`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(report);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch (e) {
                    console.error('copy failed', e);
                  }
                }}
                onMouseEnter={() => { /* hover handled by CSS */ }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <pre className={styles.preReport}>
            {report}
          </pre>
        </div>
      )}
    </div>
  );
};

export default Next15;
