'use client';

import { useEffect, useState, useRef } from 'react';

interface TimerProps {
  isRunning: boolean;
  onTimeUp?: () => void;
  maxSeconds?: number;
  label?: string;
}

export default function Timer({ isRunning, onTimeUp, maxSeconds, label }: TimerProps) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (maxSeconds && next >= maxSeconds) {
            onTimeUp?.();
          }
          return next;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, maxSeconds, onTimeUp]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="flex items-center gap-2 text-white/90 font-mono text-lg">
      {label && <span className="text-sm font-sans">{label}</span>}
      <span>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
}
