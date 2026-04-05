'use client';

import { useState, useEffect, useCallback } from 'react';

interface TimerProps {
  running: boolean;
  onTick?: (seconds: number) => void;
  initialSeconds?: number;
}

export default function Timer({ running, onTick, initialSeconds = 0 }: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  const stableOnTick = useCallback((s: number) => {
    onTick?.(s);
  }, [onTick]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSeconds(prev => {
        const next = prev + 1;
        stableOnTick(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, stableOnTick]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="flex items-center gap-2 text-lg font-bold text-purple-600">
      <span>&#9201;</span>
      <span>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
    </div>
  );
}
