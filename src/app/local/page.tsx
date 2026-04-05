'use client';

import { useState } from 'react';
import Link from 'next/link';
import JanggiBoard from '@/components/JanggiBoard';
import Timer from '@/components/Timer';
import Confetti from '@/components/Confetti';
import { Player } from '@/lib/janggi';

export default function LocalPage() {
  const [winner, setWinner] = useState<Player | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [gameKey, setGameKey] = useState(0);

  const handleGameEnd = (w: Player) => {
    setWinner(w);
  };

  const restartGame = () => {
    setWinner(null);
    setMoveCount(0);
    setGameKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      {winner && <Confetti />}
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-3">
          <Link href="/" className="text-white/80 text-sm hover:underline">
            &larr; 메인
          </Link>
          <Timer isRunning={!winner} label="경과 시간" />
          <div className="text-white/80 text-sm">
            수: {moveCount}
          </div>
        </div>

        <div className="text-center text-white/90 text-sm mb-2">
          👫 로컬 대전 - 한 기기에서 번갈아 두기
        </div>

        <JanggiBoard
          key={gameKey}
          isLocalMultiplayer
          onGameEnd={handleGameEnd}
          onMove={setMoveCount}
        />

        {winner && (
          <div className="card p-6 mt-4 text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {winner === 'cho' ? '초 (Green)' : '한 (Red)'} 승리!
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              총 {moveCount}수 만에 결판!
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={restartGame} className="btn-primary">
                다시 하기
              </button>
              <Link href="/" className="btn-secondary">
                메인으로
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
