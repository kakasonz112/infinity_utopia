"use client"
import { useEffect, useState, useCallback } from "react";
import styles from "./page.module.css";
import FilterBar from "../../components/FilterBar/FilterBar";
import React from "react";

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

export default function Kingdoms() {
  const [data, setData] = useState<KingdomsData | null>(null);
  const [biggestNetworth, setNetworth] = useState<Number | null>(0);
  const [biggestLand, setLand] = useState<Number | null>(0);
  const [filteredKingdoms, setFilteredKingdoms] = useState<Kingdom[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({
    land: [0, 0],
    networth: [0, 0],
    provinces: [0, 0],
  });
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(filters);
  const [isLoading, setIsLoading] = useState(true);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };
  
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

  // Fetch data (same as before)
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

  // Filter kingdoms (same as before)
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

  // Sorting function
  const sortKingdoms = (key: string) => {
    const direction = sortConfig.direction === "ASC" ? "DESC" : "ASC";
    setSortConfig({ key, direction });
  
    const sortedKingdoms = [...filteredKingdoms].sort((a, b) => {
      const aValue = a[key as keyof Kingdom] ?? ''; // Default to 0 if undefined
      const bValue = b[key as keyof Kingdom] ?? ''; // Default to 0 if undefined
  
      if (aValue < bValue) return direction === "ASC" ? -1 : 1;
      if (aValue > bValue) return direction === "ASC" ? 1 : -1;
      return 0;
    });
  
    setFilteredKingdoms(sortedKingdoms);
  };

  // Determine the sorting icon
  const getSortIcon = (key: string) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === "ASC" ? "▲" : "▼";
    }
    return "";
  };

  // Toggle row expansion
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

  if (isLoading) {
    return <div className={styles.loading}>Loading Kingdoms...</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Kingdom Data</h1>

      <div className={styles.info}>
        <p>
          <span>Start Date:</span> {data?.startDate}
        </p>
        <p>
          <span>End Date:</span> {data?.endDate}
        </p>
        <p>
          <span>Last Updated:</span> {data?.lastUpdated}
        </p>
      </div>

      <FilterBar onFilterChange={handleFilterChange} biggestLand={biggestLand} biggestNetworth={biggestNetworth} />

      <table className={styles.kingdomsTable}>
        <thead>
          <tr>
            <th></th>
            <th
              onClick={() => sortKingdoms("kingdomName")}
              style={{ cursor: "pointer" }}
            >
              Kingdom {getSortIcon("kingdomName")}
            </th>
            <th
              onClick={() => sortKingdoms("kingdomNumber")}
              style={{ cursor: "pointer" }}
            >
              Kingdom Number {getSortIcon("kingdomNumber")}
            </th>
            <th
              onClick={() => sortKingdoms("kingdomIsland")}
              style={{ cursor: "pointer" }}
            >
              Kingdom Island {getSortIcon("kingdomIsland")}
            </th>
            <th
              onClick={() => sortKingdoms("honor")}
              style={{ cursor: "pointer" }}
            >
              Honor {getSortIcon("honor")}
            </th>
            <th
              onClick={() => sortKingdoms("networth")}
              style={{ cursor: "pointer" }}
            >
              Networth {getSortIcon("networth")}
            </th>
            <th
              onClick={() => sortKingdoms("totalLand")}
              style={{ cursor: "pointer" }}
            >
              Total Land {getSortIcon("totalLand")}
            </th>
            <th
              onClick={() => sortKingdoms("provinceCount")}
              style={{ cursor: "pointer" }}
            >
              Province Count {getSortIcon("provinceCount")}
            </th>
            <th
              onClick={() => sortKingdoms("warsConcluded")}
              style={{ cursor: "pointer" }}
            >
              Wars Concluded {getSortIcon("warsConcluded")}
            </th>
            <th
              onClick={() => sortKingdoms("warsWon")}
              style={{ cursor: "pointer" }}
            >
              Wars Won {getSortIcon("warsWon")}
            </th>
            <th
              onClick={() => sortKingdoms("warScore")}
              style={{ cursor: "pointer" }}
            >
              War Score {getSortIcon("warScore")}
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
                    onClick={() =>
                      toggleRow(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`)
                    }
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
              </tr>
              {expandedRows.has(`${kingdom.kingdomNumber}-${kingdom.kingdomIsland}`) && (
                <tr className={styles.expandedRow}>
                  <td colSpan={10}>
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
