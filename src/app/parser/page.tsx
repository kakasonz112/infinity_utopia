"use client";
import React, { useState, useMemo, useCallback } from "react";
import styles from "./page.module.css";

// Interfaces
interface UtopiaRow {
  slot: number;
  prov: string;
  loc: string;
  player: string;
  race: string;
  personality: string;
  honor: string;
  acres: number;
  nw: string;
  nwpa: number;
  off: string;
  def: string;
  army: string;
  defHome: string;
  tpa: string;
  wpa: string;
  estWpa: number;
  lastActive: string;
  intel: string;
  role?: string;
  assignedTargetSlot?: number | "N/A";
}

interface AssignedTargetData {
  slot: number;
  prov: string;
  player: string;
  nw: string;
  acres: number;
  off: string;
  enemySlot: number | "N/A";
  enemyProv: string;
  enemyNW: string;        // raw string for display
  enemyLand: number;
  enemyOff: string;
  enemyDef: string;
  ratio: string;
}

// -- Parsing helpers --

function parseNumber(n: string): number {
  if (!n) return 0;
  // Accept decimals, commas, k/m notation
  const cleanedN = n.replace(/,/g, "").replace(/(\d)\.(?=\d{3}\b)/g, '$1'); // "105k"
  const m = cleanedN.match(/(\d+(?:\.\d+)?)([kKmM]?)/);
  if (!m) return Number(cleanedN) || 0;
  let num = parseFloat(m[1]);
  const unit = m[2]?.toLowerCase();
  if (unit === "k") num *= 1000;
  if (unit === "m") num *= 1_000_000;
  return num;
}

function determineRole(race: string, pers: string): string {
  const key = `${race} ${pers}`.trim();
  const attackers = new Set([
    "Gnome Warrior",
    "Undead Tactician",
    "Gnome Rogue",
  ]);
  return attackers.has(key) ? "Attacker" : "T/M";
}

const isUtopiaRow = (row: UtopiaRow | null): row is UtopiaRow => row !== null;

function parseBlock(raw: string): UtopiaRow[] {
  const lines = raw.split(/\r?\n+/).map((l) => l.trim()).filter((l) => /^\d{1,2}\s+/.test(l));
  return lines
    .map((line) => {
      if (line.includes("Total") || line.includes("Average")) return null;
      const parts = line.split(/\t+| {2,}/).filter(Boolean);
      const slot = Number(parts[0]);
      const provRaw = parts[1];
      const fullMatch = provRaw?.match(/\[(\d+)\](.*)\s+\((\d+:\d+)\)\s*(.*)/);
      if (!fullMatch) return null;
      const prov = fullMatch[2].trim();
      const loc = fullMatch[3];
      const player = fullMatch[4].trim();
      const race = parts[2] || "";
      const personality = parts[3] || "";
      const role = determineRole(race, personality);

      const row: UtopiaRow = {
        slot, prov, loc, player, race, personality, role,
        honor: parts[4] || "",
        acres: parseNumber(parts[5] || "0"),
        nw: parts[6] || "",
        nwpa: parseNumber(parts[7] || "0"),
        off: parts[8] || "",
        def: parts[9] || "",
        army: parts[10] || "",
        defHome: parts[11] || "",
        tpa: parts[12] || "",
        wpa: parts[13] || "",
        estWpa: parseNumber(parts[14] || "0"),
        lastActive: parts[15] || "",
        intel: parts.slice(16).join(" "),
        assignedTargetSlot: "N/A"
      };
      return row;
    })
    .filter(isUtopiaRow);
}

function parseSOM(raw: string): UtopiaRow[] {
  const lines = raw.split(/\r?\n+/);
  const slotIdx = lines.findIndex((l) => l.trim().startsWith("Slot"));
  if (slotIdx === -1) return [];
  const dataLines = lines.slice(slotIdx + 1).filter((l) => /^\d+\s+\[/.test(l.trim()));
  return dataLines.map((line) => {
    const parts = line.split(/\t+| {2,}/).filter(Boolean);
    const slot = Number(parts[0]);
    const provRaw = parts[1];
    const fullMatch = provRaw?.match(/\[(\d+)\](.*)\s+\((\d+:\d+)\)\s*(.*)/);
    let prov = "", loc = "", player = "";
    if (fullMatch) {
      prov = fullMatch[2] || "";
      loc = fullMatch[3] || "";
      player = fullMatch[4] || "";
    } else {
      const m = provRaw.match(/\[.*?\](.*)/);
      prov = m ? m[1] : provRaw;
      loc = "";
      player = "";
    }
    return {
      slot, prov, loc, player,
      race: parts[2] || "",
      personality: parts[3] || "",
      honor: "",
      acres: parseNumber(parts[4] || "0"),
      nw: parts[5] || "",
      nwpa: 0,
      off: parts[9] || "",
      def: parts[8] || "",
      army: parts[16] || "",
      defHome: parts[8] || "",
      tpa: "",
      wpa: "",
      estWpa: 0,
      lastActive: parts[18] || "",
      intel: "",
      role: determineRole(parts[2] || "", parts[3] || ""),
      assignedTargetSlot: "N/A",
    };
  });
}

// -- Assign targets with optimal NW ratio logic --
function assignTargets(
  ownRows: UtopiaRow[],
  enemyRows: UtopiaRow[],
  targets: number[],
  roleSelection: "attacker" | "tm" | "both"
): UtopiaRow[] {
  if (targets.length === 0 || ownRows.length === 0 || enemyRows.length === 0) {
    return ownRows.map((row) => ({ ...row, assignedTargetSlot: "N/A" }));
  }

  let eligibleRoles: string[] = [];
  if (roleSelection === "attacker") eligibleRoles = ["Attacker"];
  else if (roleSelection === "tm") eligibleRoles = ["T/M"];
  else eligibleRoles = ["Attacker", "T/M"];

  const eligibleAttackers = ownRows
    .filter((r) => eligibleRoles.includes(r.role || ""))
    .map((r) => ({ ...r, nwValue: parseNumber(r.nw) }));

  const enemyTargetMap = new Map(
    enemyRows
      .filter((r) => targets.includes(r.slot))
      .map((r) => [r.slot, { nw: parseNumber(r.nw), data: r }])
  );
  const sortedTargetEntries = Array.from(enemyTargetMap.entries());
  const assignedRows = [...ownRows];

  eligibleAttackers.forEach((attacker) => {
    let bestTargetSlot: number | "N/A" = "N/A";

    let inRangeTargets: Array<{ slot: number; diff: number }> = [];
    let outOfRangeTargets: Array<{ slot: number; diff: number }> = [];

    sortedTargetEntries.forEach(([targetSlot, targetData]) => {
      const targetNW = targetData.nw;
      if (attacker.nwValue === 0 || targetNW === 0) return;

      const ratio = targetNW / attacker.nwValue;

      if (ratio >= 0.8 && ratio <= 1.2) {
        inRangeTargets.push({
          slot: targetSlot,
          diff: Math.abs(ratio - 1.0),
        });
      } else {
        const edge = ratio < 0.8 ? 0.8 : 1.2;
        outOfRangeTargets.push({
          slot: targetSlot,
          diff: Math.abs(ratio - edge),
        });
      }
    });

    // Prefer inRange targets, pick closest to 1.00
    let chosen: number | "N/A" = "N/A";
    if (inRangeTargets.length > 0) {
      inRangeTargets.sort((a, b) => a.diff - b.diff);
      chosen = inRangeTargets[0].slot;
    } else if (outOfRangeTargets.length > 0) {
      outOfRangeTargets.sort((a, b) => a.diff - b.diff);
      chosen = outOfRangeTargets[0].slot;
    }

    const originalIndex = assignedRows.findIndex((r) => r.slot === attacker.slot);
    if (originalIndex !== -1) {
      assignedRows[originalIndex] = {
        ...assignedRows[originalIndex],
        assignedTargetSlot: chosen,
      };
    }
  });

  return assignedRows.map((row) => ({
    ...row,
    assignedTargetSlot: row.assignedTargetSlot !== undefined ? row.assignedTargetSlot : "N/A",
  }));
}

// -- Create assignment table data --
function createAssignedTableData(
  assignedOwnRows: UtopiaRow[],
  enemyRows: UtopiaRow[]
): AssignedTargetData[] {
  const enemyMap = new Map(enemyRows.map((r) => [r.slot, r]));
  const assignedData: AssignedTargetData[] = [];

  const eligibleRows = assignedOwnRows.filter(
    (r) => r.assignedTargetSlot !== "N/A"
  );

  eligibleRows.forEach((own) => {
    const targetSlot = own.assignedTargetSlot as number;
    const enemy = enemyMap.get(targetSlot);
    // FIX: parseNumber used for both NWs
    const ownNWValue = parseNumber(own.nw);
    const enemyNWValue = enemy ? parseNumber(enemy.nw) : 0;
    const ratio = ownNWValue > 0 ? (enemyNWValue / ownNWValue) : 0;

    assignedData.push({
      slot: own.slot,
      prov: own.prov,
      player: own.player,
      nw: own.nw,
      acres: own.acres,
      off: own.off,
      enemySlot: targetSlot,
      enemyProv: enemy?.prov || "N/A",
      enemyNW: enemy?.nw || "N/A",
      enemyLand: enemy?.acres || 0,
      enemyOff: enemy?.off || "N/A",
      enemyDef: enemy?.def || "N/A",
      ratio: (ratio * 100).toFixed(1),
    });
  });

  // Sort by enemy slot, then by own slot
  return assignedData.sort((a, b) => {
    if (a.enemySlot !== b.enemySlot) {
      return (a.enemySlot as number) - (b.enemySlot as number);
    }
    return a.slot - b.slot;
  });
}

// ---- React Component ----

export default function Page() {
  const [ownRaw, setOwnRaw] = useState("");
  const [enemyRaw, setEnemyRaw] = useState("");
  const [targetSlotsRaw, setTargetSlotsRaw] = useState("");
  const [ownRoleSelection, setOwnRoleSelection] = useState<"attacker" | "tm" | "both">("attacker");
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [enemyTab, setEnemyTab] = useState<'General' | 'Som'>('General');

  const parsedOwnRows = useMemo(() => parseBlock(ownRaw), [ownRaw]);
  const parsedEnemyRows = useMemo(() =>
    enemyTab === 'General' ? parseBlock(enemyRaw) : parseSOM(enemyRaw)
  , [enemyRaw, enemyTab]);
  const targetSlots = useMemo(
    () => targetSlotsRaw.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0),
    [targetSlotsRaw]
  );
  const assignedOwnRows = useMemo(
    () => assignTargets(parsedOwnRows, parsedEnemyRows, targetSlots, ownRoleSelection),
    [parsedOwnRows, parsedEnemyRows, targetSlots, ownRoleSelection]
  );
  const assignedRowsData = useMemo(
    () => createAssignedTableData(assignedOwnRows, parsedEnemyRows),
    [assignedOwnRows, parsedEnemyRows]
  );

  const getRowClassName = useCallback(
    (role: string | undefined) => {
      if (role === "Attacker") return styles.rowAttacker;
      if (role === "T/M") return styles.rowTM;
      return "";
    },
    [styles.rowAttacker, styles.rowTM]
  );

  // Copy Assigned Table Data as TSV
  const handleCopyAssignedTable = async () => {
    if (!assignedRowsData.length) return;

    const header = [
      "Slot",
      "Prov",
      "Player",
      "NW",
      "Land",
      "Off",
      "Enemy Slot",
      "Enemy Prov",
      "Enemy NW",
      "Enemy Land",
      "Enemy Off",
      "Enemy Def",
      "Ratio (%)"
    ].join("\t");

    const rows = assignedRowsData.map((r) =>
      [
        r.slot,
        r.prov,
        r.player,
        r.nw,
        r.acres,
        r.off,
        r.enemySlot,
        r.enemyProv,
        r.enemyNW,
        r.enemyLand,
        r.enemyOff,
        r.enemyDef,
        r.ratio
      ].join("\t")
    );

    const tsv = [header, ...rows].join("\n");

    try {
      await navigator.clipboard.writeText(tsv);
      setCopyStatus("success");
      setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 1800);
    }
  };

  // -- Main UI --
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Utopia Intel Dual Parser & Targeter</h1>

      <div className={styles.inputsWrapper}>
        {/* Own Kingdom Input */}
        <div className={styles.inputBlock}>
          <h2>Own Kingdom Data (Attackers)</h2>
          <textarea
            className={styles.inputBox}
            placeholder="Ctrl+A (select all) and Ctrl+C (copy) at old intel Own KD GENERAL tab page."
            value={ownRaw}
            onChange={(e) => setOwnRaw(e.target.value)}
          />

          <div className={styles.roleSelection}>
            <h3>Select Role for Targeting:</h3>
            <label>
              <input
                type="radio"
                value="attacker"
                checked={ownRoleSelection === "attacker"}
                onChange={() => setOwnRoleSelection("attacker")}
              />
              Attacker Role (Only Attacker/Rogue/Tactician combos)
            </label>
            <label>
              <input
                type="radio"
                value="tm"
                checked={ownRoleSelection === "tm"}
                onChange={() => setOwnRoleSelection("tm")}
              />
              T/M Role (Thief/Mystic/Non-attack combos)
            </label>
            <label>
              <input
                type="radio"
                value="both"
                checked={ownRoleSelection === "both"}
                onChange={() => setOwnRoleSelection("both")}
              />
              Attacker & T/M Roles (All Provinces)
            </label>
          </div>
        </div>

        {/* Enemy Kingdom Input */}
        <div className={styles.inputBlock}>
          <h2>Enemy Kingdom Data</h2>
          <div className={styles.tabRow}>
            <button
              className={`${styles.tabButton} ${enemyTab === 'General' ? styles.tabActive : ''}`}
              onClick={() => setEnemyTab('General')}
            >
              General
            </button>
            <button
              className={`${styles.tabButton} ${enemyTab === 'Som' ? styles.tabActive : ''}`}
              onClick={() => setEnemyTab('Som')}
            >
              Som
            </button>
          </div>
          <textarea
            className={styles.inputBox}
            placeholder={`Paste ${enemyTab === 'General' ? 'General' : 'Som'} data here`}
            value={enemyRaw}
            onChange={(e) => setEnemyRaw(e.target.value)}
          />

          <div className={styles.targetSelection}>
            <h3>Target Enemy Slots (e.g., 2,4,6):</h3>
            <textarea
              className={styles.inputBoxSmall}
              placeholder="Enter comma-separated slot numbers (e.g., 2,4,6)"
              value={targetSlotsRaw}
              onChange={(e) => setTargetSlotsRaw(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* --- Tables and Results --- */}
      {assignedRowsData.length > 0 && (
        <div className={styles.tableWrapper}>
          <div className={styles.copyBlock}>
            <button
              onClick={handleCopyAssignedTable}
              className={styles.copyButton}
              disabled={copyStatus === "success"}
              aria-label="Copy table to clipboard"
            >
              <svg viewBox="0 0 18 18" fill="none">
                <rect x="4" y="4" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="7" y="2" width="7" height="3" rx="1" fill="currentColor" opacity=".25"/>
              </svg>
              Copy Table
            </button>
            <span
              className={`${styles.copyFeedback} ${copyStatus === "idle" ? styles.hide : ""} ${
                copyStatus === "success" ? styles.copySuccess : copyStatus === "error" ? styles.copyError : ""
              }`}
            >
              {copyStatus === "success" ? "Copied!" : copyStatus === "error" ? "Error copying!" : ""}
            </span>
          </div>

          <h2>🎯 Target Assignments (NW Ratio: Enemy NW / Attacker NW)</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Slot</th>
                <th>Prov</th>
                <th>Player</th>
                <th>NW</th>
                <th>Land</th>
                <th>Off</th>
                <th>Enemy Slot</th>
                <th>Enemy Prov</th>
                <th>Enemy NW</th>
                <th>Enemy Land</th>
                <th>Enemy Off</th>
                <th>Enemy Def</th>
                <th>Ratio</th>
              </tr>
            </thead>
            <tbody>
              {assignedRowsData.map((r) => (
                <tr key={`assignment-${r.slot}`}>
                  <td>#{r.slot}</td>
                  <td>{r.prov}</td>
                  <td>{r.player}</td>
                  <td>{r.nw}</td>
                  <td>{r.acres}</td>
                  <td>{r.off}</td>
                  <td>#{r.enemySlot}</td>
                  <td>{r.enemyProv}</td>
                  <td>{r.enemyNW}</td>
                  <td>{r.enemyLand}</td>
                  <td>{r.enemyOff}</td>
                  <td>{r.enemyDef}</td>
                  <td>{r.ratio}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignedOwnRows.length > 0 && (
        <div className={styles.tableWrapper}>
          <h2>Own Kingdom Parsed Data (Full Detail)</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Slot</th>
                <th>Target</th>
                <th>Player</th>
                <th>Race</th>
                <th>Pers</th>
                <th>Role</th>
                <th>NW</th>
                <th>Off</th>
                <th>Def</th>
                <th>Army</th>
                <th>Intel</th>
              </tr>
            </thead>
            <tbody>
              {assignedOwnRows.map((r) => (
                <tr key={`own-${r.slot}`} className={getRowClassName(r.role)}>
                  <td>{r.slot}</td>
                  <td><b>{r.assignedTargetSlot}</b></td>
                  <td>{r.player}</td>
                  <td>{r.race}</td>
                  <td>{r.personality}</td>
                  <td>{r.role}</td>
                  <td>{r.nw}</td>
                  <td>{r.off}</td>
                  <td>{r.def}</td>
                  <td>{r.army}</td>
                  <td>{r.intel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {parsedEnemyRows.length > 0 && (
        <div className={styles.tableWrapper}>
          <h2>Enemy Kingdom Parsed Data</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                {[
                  "Slot", "Province", "Loc", "Player", "Race", "Pers", "Role", "Honor", "Acres", "NW", "NWPA",
                  "Off", "Def", "Army", "DefHome", "TPA", "WPA", "EstWPA", "LastActive", "Intel"
                ].map((h) => (<th key={h}>{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {parsedEnemyRows.map((r) => (
                <tr key={`enemy-${r.slot}`} className={getRowClassName(r.role)}>
                  <td>{r.slot}</td>
                  <td>{r.prov}</td>
                  <td>{r.loc}</td>
                  <td>{r.player}</td>
                  <td>{r.race}</td>
                  <td>{r.personality}</td>
                  <td>{r.role}</td>
                  <td>{r.honor}</td>
                  <td>{r.acres}</td>
                  <td>{r.nw}</td>
                  <td>{r.nwpa}</td>
                  <td>{r.off}</td>
                  <td>{r.def}</td>
                  <td>{r.army}</td>
                  <td>{r.defHome}</td>
                  <td>{r.tpa}</td>
                  <td>{r.wpa}</td>
                  <td>{r.estWpa}</td>
                  <td>{r.lastActive}</td>
                  <td>{r.intel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
