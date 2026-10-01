import { useEffect, useState } from 'react';
import { todayLocal } from '@/lib/time';

/** Today's local date, updated at midnight and when the app comes back to the foreground. */
export function useToday() {
  const [today, setToday] = useState(todayLocal);
  useEffect(() => {
    const check = () => setToday(todayLocal());
    const midnight = new Date();
    midnight.setHours(24, 0, 5, 0);
    const timer = window.setTimeout(check, midnight.getTime() - Date.now());
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [today]);
  return today;
}
