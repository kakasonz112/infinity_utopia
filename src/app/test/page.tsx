'use client';
import { useEffect, useState } from 'react';

export default function Test() {
  const [result, setResult] = useState(null);

  const test = async () => {
    const res = await fetch('/api/cron-ceasefire');
    const kingdomsJson = await res.json();
    console.log("✅ Kingdoms JSON:", kingdomsJson);



    const data = await res.json();
    setResult(data);
  };

  return (
    <div>
      <button onClick={test}>Test Cron</button>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}
