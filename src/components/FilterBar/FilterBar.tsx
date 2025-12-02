"use client";

import { useState, useCallback, useEffect } from "react";
import styles from "./FilterBar.module.css"; // Import the CSS Module

function roundToNearest50000(num: number): number {
  const rounded = Math.ceil(num / 50000) * 50000;
  return rounded;
}

function roundToNearest100(num: number): number {
  const rounded = Math.ceil(num / 100) * 100;
  return rounded;
}

// Debounce utility function (same as before)
const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

type Filters = {
  land: number[];
  networth: number[];
  provinces: number[];
};

// NEW TYPE: Ceasefire filter type
export type CfFilterType = "ALL" | "CF_ONLY";

type FilterBarProps = {
  onFilterChange: (filters: Filters) => void;
  onCfFilterChange: (cfFilter: CfFilterType) => void;
  biggestLand: number;
  biggestNetworth: number;
};

export default function FilterBar({ onFilterChange, onCfFilterChange, biggestLand, biggestNetworth }: FilterBarProps) {  const [filters, setFilters] = useState<Filters>({
    land: [500, roundToNearest100(biggestLand)], // Start at multiples of 10
    networth: [50000, roundToNearest50000(biggestNetworth)],
    provinces: [1, 25],
  });

  console.log("bggestland:", biggestLand);
 console.log(" roundToNearest100 bggestland:", roundToNearest100(biggestLand));
  // NEW STATE: Ceasefire filter state
  const [cfFilter, setCfFilter] = useState<CfFilterType>("ALL");

  // Use debounce for filters
  const debouncedFilters = useDebounce(filters, 500);

  // Handle filter changes
  const handleChange = useCallback(
    (key: keyof Filters, value: number[]) => {
      setFilters((prev) => {
        const newFilters = { ...prev, [key]: value };
        return newFilters;
      });
    },
    []
  );

  // Trigger the onFilterChange when debouncedFilters change
  useEffect(() => {
    onFilterChange(debouncedFilters);
  }, [debouncedFilters, onFilterChange]);

  // Trigger the onCfFilterChange when cfFilter changes
  useEffect(() => {
    onCfFilterChange(cfFilter);
  }, [cfFilter, onCfFilterChange]);
  
    // Format large numbers - Option 1: More decimal places for K and M
    const formatNumber = (num: number) => {
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(3)}M`; // 3 decimal places
        if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`; // 2 decimal places
        return num.toString();
    };

  return (
    <div className={styles.filterBar}>
    {/* 🛑 NEW: Ceasefire Filter Radio Buttons 🛑 */}
      <div className={styles.label} style={{ marginBottom: '15px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
          <span style={{ fontWeight: 'bold', marginRight: '15px' }}>Ceasefire Filter:</span>
          <label style={{ marginRight: '15px' }}>
              <input 
                  type="radio" 
                  name="cfFilter" 
                  value="ALL" 
                  checked={cfFilter === "ALL"} 
                  onChange={() => setCfFilter("ALL")} 
                  style={{ marginRight: '5px' }}
              />
              All Kingdoms
          </label>
          <label>
              <input 
                  type="radio" 
                  name="cfFilter" 
                  value="CF_ONLY" 
                  checked={cfFilter === "CF_ONLY"} 
                  onChange={() => setCfFilter("CF_ONLY")} 
                  style={{ marginRight: '5px' }}
              />
              Ceasefire Only
          </label>
      </div>
      {/* Land Range */}
      <label className={styles.label}>
        Land Range:
        <div className={styles.rangeContainer}>
          <div className={styles.sliderWrapper}>
            (Min)
            <input
              type="range"
              min="400"
              max={roundToNearest100(biggestLand)}
              value={filters.land[0]}
              onChange={(e) =>
                handleChange("land", [Number(e.target.value), filters.land[1]])
              }
              step="100"
              className={styles.rangeInput}
            />
            (Max)
            <input
              type="range"
              min="400"
              max={roundToNearest100(biggestLand)}
              value={filters.land[1]}
              onChange={(e) =>
                handleChange("land", [filters.land[0], Number(e.target.value)])
              }
              step="100"
              className={styles.rangeInput}
            />
          <div className={styles.rangeLabels}>
            <span>{formatNumber(filters.land[0])}</span>
            <span>{formatNumber(filters.land[1])}</span>
          </div>
          </div>
        </div>
      </label>

      {/* Networth Range */}
      <label className={styles.label}>
        Networth Range:
        <div className={styles.rangeContainer}>
          <div className={styles.sliderWrapper}>
          (Min)
            <input
              type="range"
              min="50000"
              max={roundToNearest50000(biggestNetworth)}
              value={filters.networth[0]}
              onChange={(e) =>
                handleChange("networth", [
                  Number(e.target.value),
                  filters.networth[1],
                ])
              }
              step="50000"
              className={styles.rangeInput}
            />
            (Max)
            <input
              type="range"
              min="50000"
              max={roundToNearest50000(biggestNetworth)}
              value={filters.networth[1]}
              onChange={(e) =>
                handleChange("networth", [
                  filters.networth[0],
                  Number(e.target.value),
                ])
              }
              step="50000"
              className={styles.rangeInput}
            />
            <div className={styles.rangeLabels}>
              <span>{formatNumber(filters.networth[0])}</span>
              <span>{formatNumber(filters.networth[1])}</span>
            </div>
          </div>
        </div>
      </label>

      {/* Province Count */}
      <label className={styles.label}>
        Province Count:
        <div className={styles.rangeContainer}>
        <div className={styles.sliderWrapper}>
        (Min)
          <input
            type="range"
            min="1"
            max="25"
            value={filters.provinces[0]}
            onChange={(e) =>
              handleChange("provinces", [
                Number(e.target.value),
                filters.provinces[1],
              ])
            }
            step="1"
            className={styles.rangeInput}
          />
          (Max)
          <input
            type="range"
            min="1"
            max="25"
            value={filters.provinces[1]}
            onChange={(e) =>
              handleChange("provinces", [
                filters.provinces[0],
                Number(e.target.value),
              ])
            }
            step="1"
            className={styles.rangeInput}
          />
          <div className={styles.rangeLabels}>
            <span>{filters.provinces[0]}</span>
            <span>{filters.provinces[1]}</span>
          </div>
        </div>
        </div>
      </label>
    </div>
  );
}