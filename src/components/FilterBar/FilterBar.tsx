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

export default function FilterBar({ onFilterChange, onCfFilterChange, biggestLand, biggestNetworth }: FilterBarProps) {
  const [filters, setFilters] = useState<Filters>({
    land: [500, roundToNearest100(biggestLand)], // Start at multiples of 10
    networth: [50000, roundToNearest50000(biggestNetworth)],
    provinces: [1, 25],
  });
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
      <div className={styles.filterHeader}>
        <div className={styles.filterTitle}>Filters</div>
        <div className={styles.filterHint}></div>
      </div>

      <div className={styles.cfSection}>
        <span className={styles.cfLabel}>Ceasefire Filter</span>
        <div className={styles.cfOptions}>
          <label className={styles.cfOption}>
            <input
              type="radio"
              name="cfFilter"
              value="ALL"
              checked={cfFilter === "ALL"}
              onChange={() => setCfFilter("ALL")}
            />
            <span>All Kingdoms</span>
          </label>
          <label className={styles.cfOption}>
            <input
              type="radio"
              name="cfFilter"
              value="CF_ONLY"
              checked={cfFilter === "CF_ONLY"}
              onChange={() => setCfFilter("CF_ONLY")}
            />
            <span>Ceasefire Only</span>
          </label>
        </div>
      </div>

      <div className={styles.rangeGroup}>
        <div className={styles.rangeHeader}>
          <span className={styles.rangeTitle}>Land Range</span>
          <span className={styles.rangeValues}>
            <span>Min {formatNumber(filters.land[0])}</span>
            <span>Max {formatNumber(filters.land[1])}</span>
          </span>
        </div>
        <div className={styles.sliderStack}>
          <div className={styles.sliderLine}>
            <span className={styles.sliderLabel}>Min</span>
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
          </div>
          <div className={styles.sliderLine}>
            <span className={styles.sliderLabel}>Max</span>
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
          </div>
        </div>
      </div>

      <div className={styles.rangeGroup}>
        <div className={styles.rangeHeader}>
          <span className={styles.rangeTitle}>Networth Range</span>
          <span className={styles.rangeValues}>
            <span>Min {formatNumber(filters.networth[0])}</span>
            <span>Max {formatNumber(filters.networth[1])}</span>
          </span>
        </div>
        <div className={styles.sliderStack}>
          <div className={styles.sliderLine}>
            <span className={styles.sliderLabel}>Min</span>
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
          </div>
          <div className={styles.sliderLine}>
            <span className={styles.sliderLabel}>Max</span>
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
          </div>
        </div>
      </div>

      <div className={styles.rangeGroup}>
        <div className={styles.rangeHeader}>
          <span className={styles.rangeTitle}>Province Count</span>
          <span className={styles.rangeValues}>
            <span>Min {filters.provinces[0]}</span>
            <span>Max {filters.provinces[1]}</span>
          </span>
        </div>
        <div className={styles.sliderStack}>
          <div className={styles.sliderLine}>
            <span className={styles.sliderLabel}>Min</span>
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
          </div>
          <div className={styles.sliderLine}>
            <span className={styles.sliderLabel}>Max</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}