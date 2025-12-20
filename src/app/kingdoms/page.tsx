// src/app/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from "react";
import styles from "./page.module.css";
import FilterBar, { CfFilterType } from "../../components/FilterBar/FilterBar";
import LocalDisplay from "../../components/LocalDisplay/LocalDisplay";

type Province = {
    slot: number;
    name: string;
    land: number;
    race: string;
    honorName: string;
    networth: number;
    protected: boolean;
};

type Kingdom = {
    kingdomName?: string;
    kingdomNumber: number;
    kingdomIsland: string;
    honor: number;
    networth: number;
    totalLand: number;
    provinceCount: number;
    warsConcluded: number;
    warsWon: number;
    warScore: number;
    provinces: Province[];
};

type KingdomsData = {
    startDate: string; // e.g., "2025-11-14 18:00:00"
    endDate: string;
    lastUpdated: string;
    kingdoms: Kingdom[];
};

type Filters = {
    land: number[];
    networth: number[];
    provinces: number[];
};

type CeasefireRecord = {
    warsConcluded: number;
    timestamp: number; // Real-world UNIX timestamp when CF started
    isCeasefire: boolean;
};


// --- Utopia Calendar Constants ---
const UT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "Jul"];
const DAYS_PER_MONTH = 24;
const DAYS_PER_CYCLE = UT_MONTHS.length * DAYS_PER_MONTH; // 7 * 24 = 168 days
const CEASEFIRE_HOURS = 96;

// --- End Utopia Calendar Constants ---

/**
 * Helper to convert a total number of ticks (days) since game start 
 * into the Utopia calendar format (Month Day). Ticks are 1-based.
 */
const getUtopiaDatePartsFromTicks = (totalTicks: number) => {
  const zeroBased = totalTicks;            // 0-based day index

  const year = Math.floor(zeroBased / DAYS_PER_CYCLE);   // 0,1,2,...
  const dayInYear = zeroBased % DAYS_PER_CYCLE;          // 0..167

  const monthIndex = Math.floor(dayInYear / DAYS_PER_MONTH); // 0..6
  const day = (dayInYear % DAYS_PER_MONTH) + 1;              // 1..24

  const month = UT_MONTHS[monthIndex];

  return { month, day, year };   // year is computed, not offset
};

const getUtopiaDateFromTicks = (totalTicks: number): string => {
  const { month, day, year } = getUtopiaDatePartsFromTicks(totalTicks);
  return `${month} ${day} YR ${year}`;
};
// --- End Utopia Calendar Helper ---


export default function Kingdoms() {
    const [data, setData] = useState<KingdomsData | null>(null);
    const [biggestNetworth, setNetworth] = useState<number>(0);
    const [biggestLand, setLand] = useState<number>(0);
    const [filteredKingdoms, setFilteredKingdoms] = useState<Kingdom[]>([]);
    const [originalOrder, setOriginalOrder] = useState<Kingdom[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState<Filters>({
        land: [0, 0],
        networth: [0, 0],
        provinces: [0, 0],
    });
    const [debouncedFilters, setDebouncedFilters] = useState<Filters>(filters);
    const [isLoading, setIsLoading] = useState(true);

    // ---- Ceasefire tracking state ----
    const [ceasefire, setCeasefire] = useState<{ [key: string]: CeasefireRecord }>({});
    const [cfFilter, setCfFilter] = useState<CfFilterType>("ALL");


    const formatNumber = (num: number) => new Intl.NumberFormat().format(num);

    // Sorting state: allow multiple active sorts. Newest clicked becomes highest priority.
    const [sortConfig, setSortConfig] = useState<Array<{ key: string; direction: "ASC" | "DESC" }>>([]);

    // Debounce function (same as before)
    const debounce = (fn: () => void, delay: number) => {
        let timeout: NodeJS.Timeout;
        return () => {
            clearTimeout(timeout);
            timeout = setTimeout(fn, delay);
        };
    };

    // Fetch kingdoms data (includes startDate)
    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch("/api/kingdoms");
                if (!res.ok) {
                    throw new Error("Failed to fetch kingdoms data");
                }
                const result = await res.json();
                setData(result.kingdoms);
                setNetworth(result.biggestNetworthKingdom?.networth);
                setLand(result.biggestLandKingdom?.totalLand);
                setIsLoading(false);
            } catch (error) {
                console.error("Error fetching kingdoms data:", error);
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // ---- Fetch ceasefire state ----
    useEffect(() => {
        fetch("/api/ceasefire")
            .then(res => res.ok ? res.json() : {})
            .then(setCeasefire);
    }, []);

    // Filter kingdoms (unchanged)
    const filterKingdoms = useCallback(() => {
        if (!data) return;
        
        const filtered = data.kingdoms.filter((kingdom) => {
            // Check existing numeric filters
            const passesNumericFilters = (
                kingdom.totalLand >= debouncedFilters.land[0] &&
                kingdom.totalLand <= debouncedFilters.land[1] &&
                kingdom.networth >= debouncedFilters.networth[0] &&
                kingdom.networth <= debouncedFilters.networth[1] &&
                kingdom.provinceCount >= debouncedFilters.provinces[0] &&
                kingdom.provinceCount <= debouncedFilters.provinces[1]
            );

            if (!passesNumericFilters) return false;

            // 🛑 NEW FILTER LOGIC 🛑
            if (cfFilter === "CF_ONLY") {
                const key = `${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`;
                const rec = ceasefire[key];
                
                // Only show if a ceasefire record exists AND it is currently active (remaining hours > 0)
                if (!rec || !rec.isCeasefire) return false;
                
                const elapsedHours = (Date.now() - rec.timestamp) / (1000 * 3600);
                const remainingHours = CEASEFIRE_HOURS - elapsedHours;
                
                return remainingHours > 0;
            }

            return true;
        });

        setFilteredKingdoms(filtered);
        // Save the default order for "reset to default" behavior
        setOriginalOrder(filtered);
        setExpandedRows(new Set()); 
    }, [data, debouncedFilters, cfFilter, ceasefire]);

    useEffect(() => {
        filterKingdoms();
    }, [debouncedFilters, data, filterKingdoms, cfFilter]);

    const handleFilterChange = (newFilters: Filters) => {
        setFilters(newFilters);
        debounce(() => setDebouncedFilters(newFilters), 300)();
    };
   
    const handleCfFilterChange = (newCfFilter: CfFilterType) => {
        setCfFilter(newCfFilter);
    }

    const calculateKingdomRaceDistribution = (provinces: Province[]) => {
        const distribution: { [race: string]: number } = {};
        provinces.forEach((province) => {
            distribution[province.race] = (distribution[province.race] || 0) + 1;
        });
        return distribution;
    };

    type StatusSortValue = { kind: number; ticks: number };
    type SortValue = number | string | StatusSortValue;

    const isStatusValue = (v: SortValue): v is StatusSortValue => {
        return typeof v === "object" && v !== null && "kind" in v && "ticks" in v;
    };

    // Sorting functions (supports multiple active sort keys)
    // Priority: the first column clicked remains highest priority until removed
    const sortKingdoms = (key: string) => {
        // find existing config
        const existingIndex = sortConfig.findIndex((c) => c.key === key);
        const newConfig = [...sortConfig];

        if (existingIndex === -1) {
            // not present -> add as lowest-priority (push), so first-clicked stays at index 0
            newConfig.push({ key, direction: "ASC" });
        } else {
            const cur = newConfig[existingIndex];
            if (cur.direction === "ASC") {
                newConfig[existingIndex] = { key, direction: "DESC" };
            } else {
                // was DESC -> remove (cycle to NONE)
                newConfig.splice(existingIndex, 1);
            }
        }

        setSortConfig(newConfig);

        if (newConfig.length === 0) {
            setFilteredKingdoms(originalOrder);
            return;
        }

        const valueForKey = (kingdom: Kingdom, keyName: string): SortValue => {
            if (keyName === "status") {
                const s = getWarCeasefireStatus(kingdom) ?? "";
                if (s === "NONE") return { kind: 1, ticks: 0 };
                const m = s.match(/\(([-\d.]+) ticks left\)/);
                const ticks = m ? parseFloat(m[1]) : 0;
                return { kind: 0, ticks };
            }

            const raw = kingdom[keyName as keyof Kingdom];
            if (raw === null || raw === undefined) return "";
            if (typeof raw === "number") return raw;
            if (typeof raw === "boolean") return raw ? 1 : 0;
            if (typeof raw === "string") {
                const maybeNum = Number(String(raw).replace(/,/g, ""));
                if (!isNaN(maybeNum)) return maybeNum;
                return String(raw).toLowerCase();
            }
            return String(raw);
        };

        // Always sort from the original (filtered) baseline to avoid cumulative sort artifacts
        const sortedKingdoms = [...originalOrder].sort((a, b) => {
            for (const cfg of newConfig) {
                const k = cfg.key;
                const dir = cfg.direction === "ASC" ? 1 : -1;

                const va = valueForKey(a, k);
                const vb = valueForKey(b, k);

                if (k === "status" && isStatusValue(va) && isStatusValue(vb)) {
                    if (va.kind !== vb.kind) return (va.kind - vb.kind) * dir * -1;
                    if (va.ticks !== vb.ticks) return (va.ticks < vb.ticks ? -1 : 1) * dir;
                    continue;
                }

                if (typeof va === "number" && typeof vb === "number") {
                    if (va < vb) return -1 * dir;
                    if (va > vb) return 1 * dir;
                    continue;
                }

                const sa = String(va);
                const sb = String(vb);
                const cmp = sa.localeCompare(sb);
                if (cmp !== 0) return cmp * dir;
            }
            return 0;
        });
        setFilteredKingdoms(sortedKingdoms);
    };

    const getSortIcon = (key: string) => {
        const cfg = sortConfig.find((c) => c.key === key);
        if (!cfg) return "";
        return cfg.direction === "ASC" ? "▲" : "▼";
    };

    const toggleRow = (key: string) => {
        setExpandedRows((prev) => {
            const newExpandedRows = new Set(prev);
            if (newExpandedRows.has(key)) {
                newExpandedRows.delete(key);
            } else {
                newExpandedRows.add(key);
            }
            return newExpandedRows;
        });
    };

    // Per-kingdom province sort configs: key is `${kingdomNumber}-${kingdomIsland}`
    const [provinceSortConfigs, setProvinceSortConfigs] = useState<{
        [key: string]: { key: string; direction: "ASC" | "DESC" | "NONE" };
    }>({});

    const sortProvinces = (kingdomKey: string, key: keyof Province) => {
        setProvinceSortConfigs((prev) => {
            const prevCfg = prev[kingdomKey];
            let nextDirection: "ASC" | "DESC" | "NONE";
            if (!prevCfg || prevCfg.key !== key) nextDirection = "ASC";
            else if (prevCfg.direction === "ASC") nextDirection = "DESC";
            else if (prevCfg.direction === "DESC") nextDirection = "NONE";
            else nextDirection = "ASC";

            return { ...prev, [kingdomKey]: { key: key as string, direction: nextDirection } };
        });
    };

    const getProvSortIcon = (kingdomKey: string, key: string) => {
        const cfg = provinceSortConfigs[kingdomKey];
        if (cfg?.key === key) {
            if (cfg.direction === "ASC") return "▲";
            if (cfg.direction === "DESC") return "▼";
            return "☰";
        }
        return "";
    };

    // ---- Status column logic (aligned with 96 ticks ≈ 344000000 ms) ----
    const MS_PER_TICK = 1000 * 60 * 60;        // 1 hour = 1 in-game day / tick
    const CEASEFIRE_TICKS = 96;                // 96 ticks
    const CEASEFIRE_MS = CEASEFIRE_TICKS * MS_PER_TICK;         // your 96-tick duration in ms (close to 96h)

    function getWarCeasefireStatus(kingdom: Kingdom) {
        const key = `${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`;
        const rec = ceasefire[key];

        if (!rec || !rec.isCeasefire || !data?.startDate) return "NONE";

        const nowMs = Date.now();
        const gameStartUtc = new Date(data.startDate + "Z"); // interpret as UTC
        const gameStartMs = gameStartUtc.getTime()        
        const cfStartMs = rec.timestamp;                         // ms from Date.now()

        // DEBUG: log base info
        console.log("=== CF DEBUG ===");
        console.log("Kingdom key:", key);
        console.log("gameStartMs:", gameStartMs, "->", new Date(gameStartMs).toISOString());
        console.log("cfStartMs:", cfStartMs, "->", new Date(cfStartMs).toISOString());
        console.log("nowMs:", nowMs, "->", new Date(nowMs).toISOString());

        // 1) Remaining ticks / hours for display
        const elapsedMs = nowMs - cfStartMs;
        const elapsedTicks = elapsedMs / MS_PER_TICK;            // 1 tick = 1 hour
        const remainingTicks = CEASEFIRE_TICKS - elapsedTicks;

        console.log("elapsedMs:", elapsedMs);
        console.log("elapsedTicks:", elapsedTicks);
        console.log("remainingTicks:", remainingTicks);

        if (remainingTicks <= 0) {
            console.log("CF expired -> NONE");
            return "NONE";
        }

        // 2) CF END time in real ms (using your 96-tick ≈ 344000000 ms value)
        const cfEndMs = cfStartMs + CEASEFIRE_MS;
        console.log("cfEndMs:", cfEndMs, "->", new Date(cfEndMs).toISOString());

        // 3) CF END tick index since game start (1-based)
        const diffMs = cfEndMs - gameStartMs;
        const rawTicks = diffMs / MS_PER_TICK; // 0-based
        const cfEndTick = Math.round(rawTicks) + 2;

        console.log("diffMs (cfEnd - gameStart):", diffMs);
        console.log("rawTicks (0-based):", rawTicks);
        console.log("cfEndTick (1-based):", cfEndTick);

        // 4) Convert that tick to Utopia calendar date
        const utopiaEndDate = getUtopiaDateFromTicks(cfEndTick);
        console.log("utopiaEndDate:", utopiaEndDate);
        console.log("=== END CF DEBUG ===");

        return `War CF End: ${utopiaEndDate} (${remainingTicks.toFixed(1)} ticks left)`;
    }




    if (isLoading) {
    return (
        <div className={styles.loadingWrapper}>
        <div className={styles.spinner} />
        <div className={styles.loadingText}>Loading Kingdoms...</div>
        </div>
    );
    }


    return (
        <div className={styles.container}>
            <h1 className={styles.heading}>Kingdom Data</h1>
            <div className={styles.info}>
                <p>
                    <span>Start Date:</span>
                    <LocalDisplay utcTimeString={data?.startDate ?? ""} />
                </p>
                <p>
                    <span>End Date:</span>
                    <LocalDisplay utcTimeString={data?.endDate ?? ""} />
                </p>
                <p>
                    <span>Last Updated:</span>
                    <LocalDisplay utcTimeString={data?.lastUpdated ?? ""} />
                </p>
            </div>
            <FilterBar 
                onFilterChange={handleFilterChange} 
                onCfFilterChange={handleCfFilterChange}
                biggestLand={biggestLand} 
                biggestNetworth={biggestNetworth} 
            />            
            <table className={styles.kingdomsTable}>
                <thead>
                    <tr>
                        <th></th>
                        <th onClick={() => sortKingdoms("kingdomName")} style={{ cursor: "pointer" }}>
                            Kingdom {getSortIcon("kingdomName")}
                        </th>
                        <th onClick={() => sortKingdoms("kingdomNumber")} style={{ cursor: "pointer" }}>
                            Kingdom Number {getSortIcon("kingdomNumber")}
                        </th>
                        <th onClick={() => sortKingdoms("kingdomIsland")} style={{ cursor: "pointer" }}>
                            Kingdom Island {getSortIcon("kingdomIsland")}
                        </th>
                        <th onClick={() => sortKingdoms("honor")} style={{ cursor: "pointer" }}>
                            Honor {getSortIcon("honor")}
                        </th>
                        <th onClick={() => sortKingdoms("networth")} style={{ cursor: "pointer" }}>
                            Networth {getSortIcon("networth")}
                        </th>
                        <th onClick={() => sortKingdoms("totalLand")} style={{ cursor: "pointer" }}>
                            Total Land {getSortIcon("totalLand")}
                        </th>
                        <th onClick={() => sortKingdoms("provinceCount")} style={{ cursor: "pointer" }}>
                            Province Count {getSortIcon("provinceCount")}
                        </th>
                        <th onClick={() => sortKingdoms("warsConcluded")} style={{ cursor: "pointer" }}>
                            Wars Concluded {getSortIcon("warsConcluded")}
                        </th>
                        <th onClick={() => sortKingdoms("warsWon")} style={{ cursor: "pointer" }}>
                            Wars Won {getSortIcon("warsWon")}
                        </th>
                        <th onClick={() => sortKingdoms("warScore")} style={{ cursor: "pointer" }}>
                            War Score {getSortIcon("warScore")}
                        </th>
                        {/* ---- Add the Status column here (sortable) ---- */}
                        <th onClick={() => sortKingdoms("status")} style={{ cursor: "pointer" }}>
                            Status {getSortIcon("status")}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {filteredKingdoms.map((kingdom) => (
                        <React.Fragment key={`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`}>
                            <tr>
                                <td>
                                    <button
                                        className={styles.expandButton}
                                        onClick={() => toggleRow(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`)}
                                    >
                                        {expandedRows.has(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`) ? "-" : "+"}
                                    </button>
                                </td>
                                <td>{`${kingdom.kingdomName} (${kingdom.kingdomNumber}:${kingdom.kingdomIsland})` || `Kingdom ${kingdom.kingdomNumber}`}</td>
                                <td>{formatNumber(kingdom.kingdomNumber)}</td>
                                <td>{kingdom.kingdomIsland}</td>
                                <td>{formatNumber(kingdom.honor)}</td>
                                <td>{formatNumber(kingdom.networth)}</td>
                                <td>{formatNumber(kingdom.totalLand)}</td>
                                <td>{formatNumber(kingdom.provinceCount)}</td>
                                <td>{formatNumber(kingdom.warsConcluded)}</td>
                                <td>{formatNumber(kingdom.warsWon)}</td>
                                <td>{formatNumber(kingdom.warScore)}</td>
                                {/* ---- Render the Status cell here ---- */}
                                <td>{getWarCeasefireStatus(kingdom)}</td>
                            </tr>
                            {expandedRows.has(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`) && (
                                <tr className={styles.expandedRow}>
                                    <td colSpan={12}>
                                        <table className={styles.provinceTable}>
                                            <thead>
                                                <tr>
                                                    <th onClick={() => sortProvinces(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'slot')} style={{ cursor: 'pointer' }}>
                                                        Slot {getProvSortIcon(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'slot')}
                                                    </th>
                                                    <th onClick={() => sortProvinces(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'name')} style={{ cursor: 'pointer' }}>
                                                        Name {getProvSortIcon(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'name')}
                                                    </th>
                                                    <th onClick={() => sortProvinces(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'land')} style={{ cursor: 'pointer' }}>
                                                        Land {getProvSortIcon(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'land')}
                                                    </th>
                                                    <th onClick={() => sortProvinces(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'race')} style={{ cursor: 'pointer' }}>
                                                        Race {getProvSortIcon(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'race')}
                                                    </th>
                                                    <th onClick={() => sortProvinces(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'honorName')} style={{ cursor: 'pointer' }}>
                                                        Honor {getProvSortIcon(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'honorName')}
                                                    </th>
                                                    <th onClick={() => sortProvinces(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'networth')} style={{ cursor: 'pointer' }}>
                                                        Networth {getProvSortIcon(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'networth')}
                                                    </th>
                                                    <th onClick={() => sortProvinces(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'protected')} style={{ cursor: 'pointer' }}>
                                                        Protection {getProvSortIcon(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`, 'protected')}
                                                    </th>
                                                </tr>
                                            </thead>
                                                <tbody>
                                                {(() => {
                                                    const kingdomKey = `${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`;
                                                    const cfg = provinceSortConfigs[kingdomKey];
                                                    const displayedProvinces = [...kingdom.provinces];
                                                    if (cfg && cfg.direction !== 'NONE') {
                                                        displayedProvinces.sort((a, b) => {
                                                            const aVal = a[cfg.key as keyof Province] ?? '';
                                                            const bVal = b[cfg.key as keyof Province] ?? '';

                                                            if (typeof aVal === 'number' && typeof bVal === 'number') {
                                                                return cfg.direction === 'ASC' ? aVal - bVal : bVal - aVal;
                                                            }
                                                            if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
                                                                return cfg.direction === 'ASC' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
                                                            }
                                                            return cfg.direction === 'ASC'
                                                                ? String(aVal).localeCompare(String(bVal))
                                                                : String(bVal).localeCompare(String(aVal));
                                                        });
                                                    }

                                                    return displayedProvinces.map((province) => (
                                                        <tr key={province.slot}>
                                                            <td>#{province.slot}</td>
                                                            <td>{province.name}</td>
                                                            <td>{formatNumber(province.land)}</td>
                                                            <td>{province.race}</td>
                                                            <td>{province.honorName}</td>
                                                            <td>{formatNumber(province.networth)}</td>
                                                            <td>{province.protected ? "Yes" : "No"}</td>
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                        </table>
                                        <div className={styles.raceDistribution}>
                                            <h3>Race Distribution</h3>
                                            <ul className={styles.raceList}>
                                                {Object.entries(calculateKingdomRaceDistribution(kingdom.provinces)).map(
                                                    ([race, count]) => (
                                                        <li key={race}>
                                                            <strong>{race}:</strong> {count}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}