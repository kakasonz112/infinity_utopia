"use client";

import { useState } from "react";
import styles from "./page.module.css";

interface Hit {
  prov: number;
  text: string;
  count: number;
  kingdom: string; // full kingdom ID like 5:11
}

export default function Page() {
  const [input, setInput] = useState("");
  const [groupedHits, setGroupedHits] = useState<Record<string, Hit[]>>({});

  const parse = () => {
    const lines = input.split("\n").filter(Boolean);
    const hits: Record<string, Hit> = {};

    for (const line of lines) {
      // Capture target province and full kingdom ID (X:Y)
      const match = line.match(/from (\d+ - [^(]+\((\d+:\d+)\))/);
      if (match) {
        const name = match[1].trim();
        const kingdom = match[2]; // full kingdom ID
        if (!hits[name]) {
          const provMatch = name.match(/^(\d+)\s-/);
          const prov = provMatch ? parseInt(provMatch[1]) : 0;
          hits[name] = { prov, text: name, count: 1, kingdom };
        } else {
          hits[name].count += 1;
        }
      }
    }

    // Group by kingdom (X:Y)
    const grouped: Record<string, Hit[]> = {};
    Object.values(hits).forEach((hit) => {
      if (!grouped[hit.kingdom]) grouped[hit.kingdom] = [];
      grouped[hit.kingdom].push(hit);
    });

    // Sort provinces within each kingdom by province number
    Object.keys(grouped).forEach((k) => {
      grouped[k].sort((a, b) => a.prov - b.prov);
    });

    setGroupedHits(grouped);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Target Counter</h1>

      <textarea
        className={styles.textarea}
        rows={10}
        placeholder="Paste logs here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button className={styles.button} onClick={parse}>
        Compile
      </button>

      {Object.keys(groupedHits).length > 0 &&
        Object.entries(groupedHits).map(([kingdom, hits]) => (
          <div key={kingdom} className={styles.results}>
            <h3 className={styles.kingdomTitle}>Kingdom {kingdom}</h3>
            {hits.map((hit, i) => (
              <div key={i} className={styles.resultLine}>
                <span className={styles.prov}>#{hit.prov}</span> - {hit.text.replace(/^\d+ - /, "")} -{" "}
                <b><u>{hit.count}</u></b> times {hit.count > 2 && <span className={styles.gbp}>GBP</span>}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
