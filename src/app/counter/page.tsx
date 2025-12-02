"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

interface Hit {
  prov: number;
  text: string;
  count: number;
  kingdom: string; // full kingdom ID like 3:10
}

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
  provinces: Province[];
};

type KingdomsApiResponse = {
  kingdoms: {
    startDate: string;
    endDate: string;
    lastUpdated: string;
    kingdoms: Kingdom[];
  };
};

export default function Page() {
  const [input, setInput] = useState("");
  const [groupedHits, setGroupedHits] = useState<Record<string, Hit[]>>({});
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKingdom, setCopiedKingdom] = useState<string | null>(null);
  const [kingdomsData, setKingdomsData] = useState<KingdomsApiResponse["kingdoms"] | null>(null);

  // Fetch /api/kingdoms once so we know full province lists
  useEffect(() => {
    const fetchKingdoms = async () => {
      try {
        const res = await fetch("/api/kingdoms");
        if (!res.ok) throw new Error("Failed to fetch kingdoms");
        const data: KingdomsApiResponse = await res.json();
        setKingdomsData(data.kingdoms);
      } catch (e) {
        console.error("Error fetching kingdoms:", e);
      }
    };
    fetchKingdoms();
  }, []);

  const parse = () => {
    const lines = input.split("\n").filter(Boolean);
    const hits: Record<string, Hit> = {};

    for (const line of lines) {
      // Example:
      // April 22 of YR2
      // 14 - Wanna feel my billy club ([3:12]...) ...
      const match = line.match(/from (\d+ - [^(]+\((\d+:\d+)\))/);
      if (match) {
        const name = match[1].trim();   // "14 - Wanna feel my billy club"
        const kingdom = match[2];       // "3:10"
        if (!hits[name]) {
          const provMatch = name.match(/^(\d+)\s-/);
          const prov = provMatch ? parseInt(provMatch[1], 10) : 0;
          hits[name] = { prov, text: name, count: 1, kingdom };
        } else {
          hits[name].count += 1;
        }
      }
    }

    const grouped: Record<string, Hit[]> = {};
    Object.values(hits).forEach((hit) => {
      if (!grouped[hit.kingdom]) grouped[hit.kingdom] = [];
      grouped[hit.kingdom].push(hit);
    });

    Object.keys(grouped).forEach((k) => {
      grouped[k].sort((a, b) => a.prov - b.prov);
    });

    setGroupedHits(grouped);
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScreenshot(e.target.files[0]);
      setLoading(true);

      try {
        const formData = new FormData();
        formData.append("file", e.target.files[0]);

        const response = await fetch("/api/gemini-ocr", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("OCR failed");

        const data = await response.json();
        if (data.groupedHits) {
          setGroupedHits(data.groupedHits);
          setInput("");
        }
      } catch (err) {
        console.error("Error processing screenshot:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Copy hits + unhit provinces for a single kingdom
  const copyKingdom = (kingdom: string) => {
    const hits = groupedHits[kingdom];
    if (!hits) return;

    // Hit lines
    const hitLines = hits.map(
      (hit) =>
        `#${hit.prov} - ${hit.text.replace(/^\d+ - /, "")} - ${hit.count} times${
          hit.count >= 2 ? " GBP" : ""
        }`
    );

    // Unhit lines
    const unhit = getUnhitProvinces(kingdom);
    const unhitLines = unhit.map((p) => `#${p.slot} - ${p.name} (UNHIT)`);

    // Combine, with a blank line separator if there are unhit provs
    const parts = [hitLines.join("\n")];
    if (unhitLines.length > 0) {
      parts.push(""); // blank line
      parts.push("Available provinces:");
      parts.push(unhitLines.join("\n"));
    }

    const text = parts.join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKingdom(kingdom);
        setTimeout(() => setCopiedKingdom(null), 1500);
      })
      .catch((err) => alert("Failed to copy: " + err));
  };


  // Get list of provinces in a kingdom that have NOT been hit yet
  const getUnhitProvinces = (kingdomId: string): Province[] => {
    if (!kingdomsData) return [];
    const [numStr, islStr] = kingdomId.split(":");
    const kNum = Number(numStr);
    const kIsl = Number(islStr);

    const kd = kingdomsData.kingdoms.find(
      (k) => k.kingdomNumber === kNum && Number(k.kingdomIsland) === kIsl
    );
    if (!kd) return [];

    const hits = groupedHits[kingdomId] || [];
    const hitProvSlots = new Set(hits.map((h) => h.prov));

    return kd.provinces.filter((p) => !hitProvSlots.has(p.slot));
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Kingdom Target Counter</h1>

      <textarea
        className={styles.textarea}
        rows={10}
        placeholder="Paste logs here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div className={styles.buttonGroup}>
        <button className={styles.button} onClick={parse} disabled={loading}>
          Compile
        </button>
      </div>

      {Object.keys(groupedHits).length > 0 &&
        Object.entries(groupedHits).map(([kingdom, hits]) => {
          const unhit = getUnhitProvinces(kingdom);

          return (
            <div key={kingdom} className={styles.results}>
              <div className={styles.kingdomHeader}>
                <h3 className={styles.kingdomTitle}>Kingdom {kingdom}</h3>
                <button
                  className={`${styles.copyButton} ${
                    copiedKingdom === kingdom ? styles.copied : ""
                  }`}
                  onClick={() => copyKingdom(kingdom)}
                >
                  {copiedKingdom === kingdom ? "COPIED" : "COPY"}
                </button>
              </div>

              {/* Hit provinces */}
              {hits.map((hit, i) => (
                <div key={i} className={styles.resultLine}>
                  <span className={styles.prov}>#{hit.prov}</span>
                  <span className={styles.name}>
                    {hit.text.replace(/^\d+ - /, "")}
                  </span>
                  <span className={styles.count}>
                    <b>{hit.count}</b> times{" "}
                    {hit.count > 2 && <span className={styles.gbp}>GBP</span>}
                  </span>
                </div>
              ))}

              {/* Unhit provinces for this kingdom */}
              {unhit.length > 0 && (
                <div className={styles.unhitContainer}>
                  <div className={styles.unhitHeader}>
                    <span className={styles.unhitTitle}>Available Provinces</span>
                    <span className={styles.unhitCount}>{unhit.length} remaining</span>
                  </div>
                  {unhit.map((p) => (
                    <div key={p.slot} className={styles.unhitLine}>
                      <span className={styles.unhitProv}>#{p.slot}</span>
                      <span className={styles.unhitName}>{p.name}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          );
        })}
    </div>
  );
}
