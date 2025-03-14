"use client";

import { useState, useCallback, useEffect } from "react";
import styles from "./FilterBar.module.css"; // Import the CSS Module

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

type FilterBarProps = {
  onFilterChange: (filters: Filters) => void;
};

export default function FilterBar({ onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<Filters>({
    land: [500, 232920], // Start at multiples of 10
    networth: [60000, 60000000],
    provinces: [1, 25],
  });

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

    // Format large numbers - Option 1: More decimal places for K and M
    const formatNumber = (num: number) => {
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(3)}M`; // 3 decimal places
        if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`; // 2 decimal places
        return num.toString();
    };

  return (
    <div className={styles.filterBar}>
      {/* Land Range */}
      <label className={styles.label}>
        Land Range:
        <div className={styles.rangeContainer}>
          <div className={styles.sliderWrapper}>
            <input
              type="range"
              min="400"
              max="240000"
              value={filters.land[0]}
              onChange={(e) =>
                handleChange("land", [Number(e.target.value), filters.land[1]])
              }
              step="10"
              className={styles.rangeInput}
            />
            <input
              type="range"
              min="400"
              max="240000"
              value={filters.land[1]}
              onChange={(e) =>
                handleChange("land", [filters.land[0], Number(e.target.value)])
              }
              step="10"
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
            <input
              type="range"
              min="60000"
              max="60000000"
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
            <input
              type="range"
              min="60000"
              max="60000000"
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