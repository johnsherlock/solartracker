'use client';

import { useEffect, useState } from 'react';
import { formatClockTime } from '@/src/live/chartUtils';

export function LiveClockChip({
  timezone,
  initialTime,
  className = 'inline-flex min-w-[92px] justify-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5',
}: {
  timezone: string;
  initialTime: string;
  className?: string;
}) {
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    const updateClock = () => setTime(formatClockTime(new Date(), timezone));
    updateClock();
    const intervalId = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(intervalId);
  }, [timezone]);

  return <span className={className}>{time}</span>;
}
