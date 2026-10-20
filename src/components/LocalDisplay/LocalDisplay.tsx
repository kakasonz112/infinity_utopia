'use client';

import { useEffect, useState } from 'react';

export default function LocalTimeDisplay({ utcTimeString }: { utcTimeString: string | undefined }) {
 const [formatted, setFormatted] = useState('Loading…');
 useEffect(() => {
  if (!utcTimeString) { setFormatted('No date provided'); return; }
  const normalized = utcTimeString.trim().replace(' ', 'T');
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(normalized) ? normalized : normalized + 'Z');
  setFormatted(Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB', {
   day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date) : 'Date unavailable');
 }, [utcTimeString]);
 return <div>{formatted}</div>;
}
