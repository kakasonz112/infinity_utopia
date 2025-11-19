"use client";

import React, { useState } from "react";
import styles from "./page.module.css";

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
  assignedTargetSlot?: number | 'N/A';
}

interface AssignedTargetData {
  slot: number;
  prov: string;
  player: string;
  nw: string;
  acres: number;
  off: string;
  enemySlot: number | 'N/A';
  enemyProv: string;
  enemyOff: string;
  enemyDef: string;
  ratio: string; // Now stores formatted percentage string
}

export default function Page() {
  const [ownRaw, setOwnRaw] = useState("");
  const [enemyRaw, setEnemyRaw] = useState("");
  const [targetSlotsRaw, setTargetSlotsRaw] = useState("");
  const [ownRoleSelection, setOwnRoleSelection] = useState<'attacker' | 'tm' | 'both'>('attacker');
  const [ownRows, setOwnRows] = useState<UtopiaRow[]>([]);
  const [enemyRows, setEnemyRows] = useState<UtopiaRow[]>([]);
  // NEW STATE for the assignment table
  const [assignedRowsData, setAssignedRowsData] = useState<AssignedTargetData[]>([]); 

  // --- UTILITY FUNCTIONS ---

  function parseNumber(n: string): number {
    if (!n) return 0;
    const cleanedN = n.replace(/[.,]/g, '');
    const m = cleanedN.match(/(\d+)([kKmM]?)/);
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

  // Helper function to dynamically determine row class
  const getRowClassName = (role: string | undefined) => {
    if (role === 'Attacker') {
      return styles.rowAttacker;
    }
    if (role === 'T/M') {
      return styles.rowTM;
    }
    return '';
  };

  // --- CORE TARGET ASSIGNMENT LOGIC ---
  function assignTargets(
    ownRows: UtopiaRow[],
    enemyRows: UtopiaRow[],
    targets: number[],
    roleSelection: 'attacker' | 'tm' | 'both'
  ): UtopiaRow[] {
    if (targets.length === 0 || ownRows.length === 0 || enemyRows.length === 0) {
      return ownRows.map(row => ({ ...row, assignedTargetSlot: 'N/A' }));
    }

    // 1. Filter Own Provinces by Role Selection
    let eligibleRoles: string[] = [];
    if (roleSelection === 'attacker') eligibleRoles = ['Attacker'];
    else if (roleSelection === 'tm') eligibleRoles = ['T/M'];
    else eligibleRoles = ['Attacker', 'T/M'];

    const eligibleAttackers = ownRows
      .filter(r => eligibleRoles.includes(r.role || ''))
      .map(r => ({ ...r, nwValue: parseNumber(r.nw) }));

    // 2. Map Enemy Targets to a useful object (Slot -> NW)
    const enemyTargetMap = new Map(
      enemyRows
        .filter(r => targets.includes(r.slot))
        .map(r => [r.slot, { nw: parseNumber(r.nw), data: r }])
    );
    
    // Sort targets by NW to ensure a consistent tie-breaking behavior (optional but good practice)
    const sortedTargetEntries = Array.from(enemyTargetMap.entries());

    const assignedRows = [...ownRows]; // Copy of all own rows

    // 3. Assign targets
    eligibleAttackers.forEach(attacker => {
      let bestTargetSlot: number | 'N/A' = 'N/A';
      let minDifference = Infinity; 

      sortedTargetEntries.forEach(([targetSlot, targetData]) => {
        const targetNW = targetData.nw;
        if (attacker.nwValue === 0) return; 

        const ratio = targetNW / attacker.nwValue; 

        if (ratio >= 0.8 && ratio <= 1.2) {
          // In range: closer to 1.0 is better.
          const differenceFromOne = Math.abs(ratio - 1.0);
          
          if (differenceFromOne < minDifference) {
            minDifference = differenceFromOne;
            bestTargetSlot = targetSlot;
          }
        } else {
          // Out of range: pick the one closest to either 80% or 120% boundary.
          const currentDifference = Math.min(Math.abs(ratio - 0.8), Math.abs(ratio - 1.2));

          // If the difference is smaller, update.
          if (currentDifference < minDifference) {
            minDifference = currentDifference;
            bestTargetSlot = targetSlot;
          }
        }
      });

      // Update the original row in the assignedRows array
      const originalIndex = assignedRows.findIndex(r => r.slot === attacker.slot);
      if (originalIndex !== -1) {
        assignedRows[originalIndex] = { 
          ...assignedRows[originalIndex], 
          assignedTargetSlot: bestTargetSlot 
        };
      }
    });

    // Ensure unassigned rows also have the new field
    return assignedRows.map(row => ({ 
      ...row, 
      assignedTargetSlot: row.assignedTargetSlot !== undefined ? row.assignedTargetSlot : 'N/A'
    }));
  }

  // --- NEW FUNCTION: Create data for the Assignment Table ---
  function createAssignedTableData(assignedOwnRows: UtopiaRow[], enemyRows: UtopiaRow[]): AssignedTargetData[] {
    const enemyMap = new Map(enemyRows.map(r => [r.slot, r]));
    const assignedData: AssignedTargetData[] = [];

    // Filter only provinces that have been assigned a target (Attacker/T/M)
    const eligibleRows = assignedOwnRows.filter(r => r.assignedTargetSlot !== 'N/A');

    eligibleRows.forEach(own => {
      const targetSlot = own.assignedTargetSlot as number;
      const enemy = enemyMap.get(targetSlot);
      
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
        enemyProv: enemy?.prov || 'N/A',
        enemyOff: enemy?.off || 'N/A',
        enemyDef: enemy?.def || 'N/A',
        // MODIFICATION 1: Calculate and format ratio as percentage
        ratio: (ratio * 100).toFixed(1), 
      });
    });

    // MODIFICATION 2: Sort by Enemy Slot, then by Attacker Slot
    return assignedData.sort((a, b) => {
        // Primary sort: enemySlot ascending
        if (a.enemySlot !== b.enemySlot) {
            // Since we filtered 'N/A' out, we can safely compare numbers
            return (a.enemySlot as number) - (b.enemySlot as number); 
        }
        // Secondary sort: slot ascending
        return a.slot - b.slot;
    });
  }


  // --- PARSE & ASSIGN LOGIC (Unchanged) ---
  function parseBoth() {
    const parsedOwnRows = parseBlock(ownRaw);
    const parsedEnemyRows = parseBlock(enemyRaw);

    const targetSlots = targetSlotsRaw
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n) && n > 0);

    const assignedOwnRows = assignTargets(
        parsedOwnRows, 
        parsedEnemyRows, 
        targetSlots, 
        ownRoleSelection
    );
    
    setOwnRows(assignedOwnRows);
    setEnemyRows(parsedEnemyRows);
    setAssignedRowsData(createAssignedTableData(assignedOwnRows, parsedEnemyRows));
  }


  // --- UNIVERSAL PARSE BLOCK (Unchanged) ---
// Define a type guard function for clarity and reuse (optional, but good practice)
const isUtopiaRow = (row: UtopiaRow | null): row is UtopiaRow => row !== null;

// --- UNIVERSAL PARSE BLOCK ---
function parseBlock(raw: string): UtopiaRow[] {
  const lines = raw
    .split(/\r?\n+/)
    .map((l) => l.trim())
    // 1. Initial Filter: Keep only lines that start with a slot number
    .filter((l) => /^\d{1,2}\s+/.test(l));

  const parsedData = lines
    .map((line) => {
      
      // Filter out 'Total'/'Average' lines
      if (line.includes("Total") || line.includes("Average")) {
        return null; 
      }
        
      const parts = line.split(/\t+| {2,}/).filter(Boolean);
      
      const slot = Number(parts[0]);
      const provRaw = parts[1];
      
      const fullMatch = provRaw?.match(/\[(\d+)\](.*)\s+\((\d+:\d+)\)\s*(.*)/);

      // LOC CHECK: Ignore provinces missing location data (Loc:Loc).
      if (!fullMatch) {
        return null; 
      }
      
      const prov = fullMatch[2].trim();
      const loc = fullMatch[3];
      const player = fullMatch[4].trim();
      
      const race = parts[2] || "";
      const personality = parts[3] || "";
      const role = determineRole(race, personality);

      // Explicitly construct and return UtopiaRow here
      const row: UtopiaRow = {
        slot,
        prov,
        loc,
        player,
        race,
        personality,
        role,
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
        assignedTargetSlot: 'N/A',
      };
      
      return row;
    })
    // 4. Use the type guard (or inline predicate) to assert the type after filtering
    .filter(isUtopiaRow); // Using the predefined function

    return parsedData;
}

  // --- RENDER BLOCK ---
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Utopia Intel Dual Parser & Targeter</h1>

      {/* Input Fields */}
      <div className={styles.inputsWrapper}>
        {/* Own Kingdom Input */}
        <div className={styles.inputBlock}>
          <h2>Own Kingdom Data (Attackers)</h2>
          <textarea
            className={styles.inputBox}
            placeholder="Ctrl+A (select all) and Ctrl+C (copy) at old intel Own KD GENERAL tab page. "
            value={ownRaw}
            onChange={(e) => setOwnRaw(e.target.value)}
          />

          <div className={styles.roleSelection}>
            <h3>Select Role for Targeting:</h3>
            <label>
              <input 
                type="radio" 
                value="attacker" 
                checked={ownRoleSelection === 'attacker'} 
                onChange={() => setOwnRoleSelection('attacker')}
              /> 
              Attacker Role (Only Attacker/Rogue/Tactician combos)
            </label>
            <label>
              <input 
                type="radio" 
                value="tm" 
                checked={ownRoleSelection === 'tm'} 
                onChange={() => setOwnRoleSelection('tm')}
              /> 
              T/M Role (Thief/Mystic/Non-attack combos)
            </label>
            <label>
              <input 
                type="radio" 
                value="both" 
                checked={ownRoleSelection === 'both'} 
                onChange={() => setOwnRoleSelection('both')}
              /> 
              Attacker & T/M Roles (All Provinces)
            </label>
          </div>
        </div>

        {/* Enemy Kingdom Input */}
        <div className={styles.inputBlock}>
          <h2>Enemy Kingdom Data</h2>
          <textarea
            className={styles.inputBox}
            placeholder="Ctrl+A (select all) and Ctrl+C (copy) at old intel Enemy KD GENERAL tab page. "
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

      <button onClick={parseBoth} className={styles.parseButton}>
        Parse & Assign Targets
      </button>

      {/* --------------------- NEW ASSIGNMENT TABLE --------------------- */}
      {assignedRowsData.length > 0 && (
        <div className={styles.tableWrapper}>
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
                <th>Enemy Off</th>
                <th>Enemy Def</th>
                <th>Ratio</th>
              </tr>
            </thead>
            <tbody>
              {assignedRowsData.map((r) => (
                <tr key={`assignment-${r.slot}`}>
                  <td>{r.slot}</td>
                  <td>{r.prov}</td>
                  <td>{r.player}</td>
                  <td>{r.nw}</td>
                  <td>{r.acres}</td>
                  <td>{r.off}</td>
                  <td>{r.enemySlot}</td>
                  <td>{r.enemyProv}</td>
                  <td>{r.enemyOff}</td>
                  <td>{r.enemyDef}</td>
                  <td>{r.ratio}%</td> {/* MODIFICATION 3: Added % symbol */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* ---------------------------------------------------------------- */}


      {/* Original Own Kingdom Table (Now optional/less important) */}
      {ownRows.length > 0 && (
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
              {ownRows.map((r) => (
                <tr key={`own-${r.slot}`} className={getRowClassName(r.role)}>
                  <td>{r.slot}</td>
                  <td>**{r.assignedTargetSlot}**</td>
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
      
      {/* Enemy Rows Table */}
            {enemyRows.length > 0 && (
        <div className={styles.tableWrapper}>
          <h2>Enemy Kingdom Parsed Data</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                {[
                  "Slot", "Province", "Loc", "Player", "Race", "Pers", "Role", "Honor", "Acres", "NW", "NWPA", "Off", "Def", "Army", "DefHome", "TPA", "WPA", "EstWPA", "LastActive", "Intel",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enemyRows.map((r) => (
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