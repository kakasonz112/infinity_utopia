'use client';

import { useEffect, useRef } from 'react';

/** Measure real header widths so pinned columns never overlap after layout changes. */
export function useFrozenColumns(columnsKey: string) {
  const ref = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const cells = Array.from(table.querySelectorAll<HTMLElement>(':scope > thead > tr > [data-frozen]'));
    function measure() {
      let left = 0;
      for (const cell of cells) {
        table!.style.setProperty(`--freeze-${cell.dataset.frozen}`, `${left}px`);
        left += cell.getBoundingClientRect().width;
      }
    }
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    cells.forEach(cell => observer?.observe(cell));
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [columnsKey]);
  return ref;
}
