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
  const zeroBased = totalTicks - 1;            // 0-based day index

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

    // Sorting state
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "ASC" | "DESC" }>({
        key: "kingdomName",
        direction: "ASC",
    });

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

    // Sorting functions (unchanged)
    const sortKingdoms = (key: string) => {
        const direction = sortConfig.direction === "ASC" ? "DESC" : "ASC";
        setSortConfig({ key, direction });

        const sortedKingdoms = [...filteredKingdoms].sort((a, b) => {
            const aValue = a[key as keyof Kingdom] ?? '';
            const bValue = b[key as keyof Kingdom] ?? '';
            if (aValue < bValue) return direction === "ASC" ? -1 : 1;
            if (aValue > bValue) return direction === "ASC" ? 1 : -1;
            return 0;
        });
        setFilteredKingdoms(sortedKingdoms);
    };

    const getSortIcon = (key: string) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === "ASC" ? "▲" : "▼";
        }
        return "";
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
        return <div className={styles.loading}>Loading Kingdoms...</div>;
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
                        {/* ---- Add the Status column here ---- */}
                        <th>Status</th>
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
                                                    <th>Slot</th>
                                                    <th>Name</th>
                                                    <th>Land</th>
                                                    <th>Race</th>
                                                    <th>Honor</th>
                                                    <th>Networth</th>
                                                    <th>Protection</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {kingdom.provinces.map((province) => (
                                                    <tr key={province.slot}>
                                                        <td>{province.slot}</td>
                                                        <td>{province.name}</td>
                                                        <td>{formatNumber(province.land)}</td>
                                                        <td>{province.race}</td>
                                                        <td>{province.honorName}</td>
                                                        <td>{formatNumber(province.networth)}</td>
                                                        <td>{formatNumber(province.networth)}</td>
                                                        <td>{province.protected ? "Yes" : "No"}</td>
                                                    </tr>
                                                ))}
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