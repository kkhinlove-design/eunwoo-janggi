'use client';

import { useEffect, useState } from 'react';

const COLORS = ['#ff6b35', '#ff6b9d', '#2ec4b6', '#ffd166', '#06d6a0', '#118ab2', '#ff9f1c', '#e71d36'];

export default function Confetti() {
  const [pieces, setPieces] = useState<Array<{ id: number; left: number; color: string; delay: number; size: number }>>([]);

  useEffect(() => {
    const newPieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 2,
      size: 6 + Math.random() * 8,
    }));
    setPieces(newPieces);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}
