"use client";

import { useState, useEffect } from 'react';
import moment from 'moment-timezone'; // Important: Use moment-timezone

function LocalTimeDisplay({ utcTimeString }: { utcTimeString: string | undefined }) {
  const [localTimeString, setLocalTimeString] = useState<string | null>(null);

  useEffect(() => {
    if (utcTimeString) {
      const localTime = moment.utc(utcTimeString).local().format('DD MMMM YYYY, HH:mm');
      setLocalTimeString(localTime);
    } else {
      setLocalTimeString("No date provided");
    }

  }, [utcTimeString]);

  return <div>{localTimeString ? `${localTimeString}` : 'Loading...'}</div>;
}

export default LocalTimeDisplay;