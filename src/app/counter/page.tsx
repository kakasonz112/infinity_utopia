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
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // This 'parse' function is kept for manual text pasting in the textarea.
  const parse = () => {
    const lines = input.split("\n").filter(Boolean);
    const hits: Record<string, Hit> = {};

    for (const line of lines) {
      const match = line.match(/from (\d+ - [^(]+\((\d+:\d+)\))/);
      if (match) {
        const name = match[1].trim();
        const kingdom = match[2];
        if (!hits[name]) {
          const provMatch = name.match(/^(\d+)\s-/);
          const prov = provMatch ? parseInt(provMatch[1]) : 0;
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
        // Call Gemini AI OCR endpoint
        const formData = new FormData();
        formData.append('file', e.target.files[0]);

        const response = await fetch('/api/gemini-ocr', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('OCR failed');

        const data = await response.json();
        
        // --- FIX ---
        // API now returns the fully parsed object { groupedHits: {...} }
        if (data.groupedHits) {
            // Directly set the grouped hits data returned from the API
            setGroupedHits(data.groupedHits); 
            
            // Clear the textarea since the logic is now handled by the API
            setInput("");
        }
        // --- END OF FIX ---
      } catch (err) {
        console.error('Error processing screenshot:', err);
      } finally {
        setLoading(false);
      }
    }
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

        <label className={styles.button} style={{ cursor: 'pointer', textAlign: 'center' }}>
          {loading ? 'Processing...' : 'Upload Screenshot'}
          <input type="file" accept="image/*" onChange={handleScreenshotUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {Object.keys(groupedHits).length > 0 &&
        Object.entries(groupedHits).map(([kingdom, hits]) => (
          <div key={kingdom} className={styles.results}>
            <h3 className={styles.kingdomTitle}>Kingdom {kingdom}</h3>
            {hits.map((hit, i) => (
              <div key={i} className={styles.resultLine}>
                <span className={styles.prov}>#{hit.prov}</span> - {hit.text.replace(/^\d+ - /, '')} -{' '}
                <b><u>{hit.count}</u></b> times {hit.count > 2 && <span className={styles.gbp}>GBP</span>}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}