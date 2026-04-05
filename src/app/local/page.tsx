'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import JanggiBoard from '@/components/JanggiBoard';
import Timer from '@/components/Timer';
import Confetti from '@/components/Confetti';
import { Player } from '@/lib/janggi';

type GamePhase = 'setup' | 'playing' | 'ended';

export default function LocalPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [result, setResult] = useState<{ winner: Player } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [gameKey, setGameKey] = useState(0);

  const startGame = () => {
    setPhase('playing');
    setTimerRunning(true);
    setResult(null);
    setMoveCount(0);
    setGameKey(k => k + 1);
  };

  const handleGameEnd = useCallback((winner: Player) => {
    setResult({ winner });
    setPhase('ended');
    setTimerRunning(false);
  }, []);

  const getWinnerName = () => {
    if (!result) return '';
    if (result.winner === 'cho') return `${player1 || '초'} 승리!`;
    return `${player2 || '한'} 승리!`;
  };

  if (phase === 'setup') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="game-card w-full max-w-md space-y-6">
          <button
            onClick={() => router.push('/')}
            className="text-purple-500 text-sm font-semibold hover:text-purple-700"
          >
            &larr; 돌아가기
          </button>

          <h2 className="text-2xl font-extrabold text-center text-purple-700">
            👫 친구와 대결
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-bold text-purple-600 mb-1 block">
                🟢 초 플레이어 (선공)
              </label>
              <input
                type="text"
                value={player1}
                onChange={e => setPlayer1(e.target.value)}
                placeholder="이름 (선택)"
                className="w-full px-4 py-2 rounded-xl border-2 border-purple-200 focus:border-purple-500 outline-none font-semibold"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-purple-600 mb-1 block">
                🔴 한 플레이어 (후공)
              </label>
              <input
                type="text"
                value={player2}
                onChange={e => setPlayer2(e.target.value)}
                placeholder="이름 (선택)"
                className="w-full px-4 py-2 rounded-xl border-2 border-purple-200 focus:border-purple-500 outline-none font-semibold"
              />
            </div>
          </div>

          <button onClick={startGame} className="btn-primary w-full py-4 text-lg">
            게임 시작!
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4 pt-6">
      {/* Header */}
      <div className="w-full max-w-2xl flex flex-wrap items-center justify-between mb-4">
        <button
          onClick={() => {
            setPhase('setup');
            setTimerRunning(false);
          }}
          className="text-purple-500 text-sm font-semibold hover:text-purple-700"
        >
          &larr; 설정
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-gray-600">
            <span className="text-purple-600">{player1 || '초'}</span>
            {' vs '}
            <span className="text-pink-500">{player2 || '한'}</span>
          </span>
          <Timer running={timerRunning} />
        </div>
      </div>

      {/* Board */}
      <JanggiBoard
        key={gameKey}
        isLocalMultiplayer
        onGameEnd={handleGameEnd}
        onMove={setMoveCount}
      />

      {/* Result overlay */}
      {phase === 'ended' && result && (
        <>
          <Confetti />
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
            <div className="game-card text-center space-y-4 animate-bounce-in max-w-sm w-full">
              <div className="text-5xl">🏆</div>
              <h2 className="text-2xl font-extrabold text-purple-700">
                {getWinnerName()}
              </h2>
              <p className="text-gray-500 text-sm">
                {result.winner === 'cho' ? '초(Green)' : '한(Red)'} 승리 | {moveCount}수
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPhase('setup');
                    setResult(null);
                  }}
                  className="btn-secondary flex-1 py-3"
                >
                  설정으로
                </button>
                <button
                  onClick={startGame}
                  className="btn-primary flex-1 py-3"
                >
                  다시 하기
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
