'use client';

import { useState } from 'react';
import Link from 'next/link';
import JanggiBoard from '@/components/JanggiBoard';
import Timer from '@/components/Timer';
import Confetti from '@/components/Confetti';
import { Player } from '@/lib/janggi';
import { AiLevel } from '@/lib/janggi-ai';

const AI_LEVELS: { key: AiLevel; label: string; desc: string }[] = [
  { key: 'baby', label: '아기', desc: '랜덤 수' },
  { key: 'student', label: '학생', desc: '기물 먹기 우선' },
  { key: 'genius', label: '천재', desc: '2수 앞 계산' },
  { key: 'robot', label: '로봇', desc: '3수 앞 계산' },
];

export default function PlayPage() {
  const [gameStarted, setGameStarted] = useState(false);
  const [playerSide, setPlayerSide] = useState<Player>('cho');
  const [aiLevel, setAiLevel] = useState<AiLevel>('student');
  const [winner, setWinner] = useState<Player | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [gameKey, setGameKey] = useState(0);

  const startGame = () => {
    setGameStarted(true);
    setWinner(null);
    setMoveCount(0);
    setGameKey((k) => k + 1);
  };

  const handleGameEnd = (w: Player) => {
    setWinner(w);
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full">
          <Link href="/" className="text-purple-600 text-sm hover:underline mb-4 inline-block">
            &larr; 메인으로
          </Link>
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            🤖 AI 대전 설정
          </h2>

          {/* Side selection */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">진영 선택</p>
            <div className="flex gap-3">
              <button
                onClick={() => setPlayerSide('cho')}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                  playerSide === 'cho'
                    ? 'bg-green-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                초 (Green)
                <div className="text-xs font-normal mt-0.5">선공</div>
              </button>
              <button
                onClick={() => setPlayerSide('han')}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                  playerSide === 'han'
                    ? 'bg-red-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                한 (Red)
                <div className="text-xs font-normal mt-0.5">후공</div>
              </button>
            </div>
          </div>

          {/* AI level */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">AI 난이도</p>
            <div className="grid grid-cols-2 gap-2">
              {AI_LEVELS.map((lvl) => (
                <button
                  key={lvl.key}
                  onClick={() => setAiLevel(lvl.key)}
                  className={`py-3 px-4 rounded-xl text-left transition-all ${
                    aiLevel === lvl.key
                      ? 'bg-purple-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="font-bold">{lvl.label}</div>
                  <div className={`text-xs ${aiLevel === lvl.key ? 'text-purple-200' : 'text-gray-500'}`}>
                    {lvl.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={startGame} className="btn-primary w-full text-lg">
            게임 시작!
          </button>
        </div>
      </div>
    );
  }

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

        <JanggiBoard
          key={gameKey}
          playerSide={playerSide}
          aiLevel={aiLevel}
          onGameEnd={handleGameEnd}
          onMove={setMoveCount}
        />

        {winner && (
          <div className="card p-6 mt-4 text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {winner === playerSide ? '축하합니다! 승리!' : 'AI가 이겼습니다...'}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {winner === 'cho' ? '초 (Green)' : '한 (Red)'} 승리 | {moveCount}수
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={startGame} className="btn-primary">
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
