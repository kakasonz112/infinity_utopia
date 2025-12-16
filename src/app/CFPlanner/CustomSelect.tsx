"use client";

import React, { useEffect, useRef, useState } from "react";

type Option = { label: string; value: number };

type Props = {
  options: Option[];
  value: number;
  onChange: (v: number) => void;
  className?: string;
};

export default function CustomSelect({ options, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, []);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} style={{ position: "relative" }} className={className}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "0.4rem 0.6rem",
          borderRadius: "0.5rem",
          border: "1px solid rgba(55,65,81,0.9)",
          background: "radial-gradient(circle at top left, rgba(30,64,175,0.32), rgba(15,23,42,0.98))",
          color: "#e5e7eb",
          cursor: "pointer",
        }}
      >
        {selected.label}
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            marginTop: 6,
            zIndex: 60,
            listStyle: "none",
            padding: 0,
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
            border: "1px solid rgba(55,65,81,0.9)",
            background: "#0b1220",
          }}
        >
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onChange(o.value);
                  setOpen(false);
                }
              }}
              style={{
                padding: "0.45rem 0.6rem",
                cursor: "pointer",
                color: "#e5e7eb",
                background: o.value === value ? "rgba(37,99,235,0.18)" : "transparent",
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
