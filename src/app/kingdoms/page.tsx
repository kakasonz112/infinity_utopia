"use client";
import React, { useEffect, useState, useCallback } from "react";
import styles from "./page.module.css";
import FilterBar from "../../components/FilterBar/FilterBar";
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
  startDate: string;
  endDate: string;
  lastUpdated: string;
  kingdoms: Kingdom[];
};

type Filters = {
  land: number[];
  networth: number[];
  provinces: number[];
};

const CEASEFIRE_HOURS = 96;

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
  const [ceasefire, setCeasefire] = useState<{ [key: string]: { warsConcluded: number; timestamp: number } }>({});

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

  // Fetch kingdoms data (unchanged)
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

  // ---- Update ceasefire state on warsConcluded changes ----
  useEffect(() => {
    if (!data || !data.kingdoms) return;
    const updates: { [key: string]: { warsConcluded: number; timestamp: number } } = {};
    data.kingdoms.forEach((k: Kingdom) => {
      const key = `${k.kingdomNumber}-${k.kingdomIsland}`;
      const prev = ceasefire[key];
      if (!prev || k.warsConcluded > prev.warsConcluded) {
        updates[key] = { warsConcluded: k.warsConcluded, timestamp: Date.now() };
      }
    });
    // PATCH only if there are new updates
    if (Object.keys(updates).length) {
      fetch("/api/ceasefire", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).then(() =>
        fetch("/api/ceasefire")
          .then(res => res.json())
          .then(setCeasefire)
      );
    }
    // eslint-disable-next-line
  }, [data]);

  // Filter kingdoms (unchanged)
  const filterKingdoms = useCallback(() => {
    if (!data) return;
    const filtered = data.kingdoms.filter((kingdom) => {
      return (
        kingdom.totalLand >= debouncedFilters.land[0] &&
        kingdom.totalLand <= debouncedFilters.land[1] &&
        kingdom.networth >= debouncedFilters.networth[0] &&
        kingdom.networth <= debouncedFilters.networth[1] &&
        kingdom.provinceCount >= debouncedFilters.provinces[0] &&
        kingdom.provinceCount <= debouncedFilters.provinces[1]
      );
    });
    setFilteredKingdoms(filtered);
    setExpandedRows(new Set()); // Clear expanded rows
  }, [data, debouncedFilters]);

  useEffect(() => {
    filterKingdoms();
  }, [debouncedFilters, data, filterKingdoms]);

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    debounce(() => setDebouncedFilters(newFilters), 300)();
  };

  const calculateKingdomRaceDistribution = (provinces: Province[]) => {
    const distribution: { [race: string]: number } = {};
    provinces.forEach((province) => {
      distribution[province.race] = (distribution[province.race] || 0) + 1;
    });
    return distribution;
  };

  // Sorting function (unchanged)
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

  // Sorting icon (unchanged)
  const getSortIcon = (key: string) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === "ASC" ? "▲" : "▼";
    }
    return "";
  };

  // Toggle row expansion (unchanged)
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

  // ---- Status column logic ----
  function getWarCeasefireStatus(kingdom: Kingdom) {
    const key = `${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`;
    const rec = ceasefire[key];
    if (!rec) return "NONE";
    if (rec.timestamp === 0 || rec.warsConcluded === 0) return "NONE";
    const elapsed = (Date.now() - rec.timestamp) / (1000 * 3600);
    if (elapsed > CEASEFIRE_HOURS) return "NONE";
    return `War CeaseFire (${(CEASEFIRE_HOURS - elapsed).toFixed(1)} hours left)`;
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
      <FilterBar onFilterChange={handleFilterChange} biggestLand={biggestLand} biggestNetworth={biggestNetworth} />
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
