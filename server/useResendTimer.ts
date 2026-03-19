import { useEffect, useState } from "react";

export function useResendTimer(initial = 60) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (time <= 0) return;

    const timer = setTimeout(() => setTime((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [time]);

  return {
    time,
    start: () => setTime(initial),
    reset: () => setTime(0),
  };
}