'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import JanggiBoard from '@/components/JanggiBoard';
import Timer from '@/components/Timer';
import Confetti from '@/components/Confetti';
import { Player } from '@/lib/janggi';
import { AiLevel } from '@/lib/janggi-ai';

type GamePhase = 'setup' | 'playing' | 'ended';

const AI_LEVELS: { key: AiLevel; label: string; emoji: string; desc: string }[] = [
  { key: 'baby', label: '아기 AI', emoji: '👶', desc: '랜덤 수' },
  { key: 'student', label: '학생 AI', emoji: '🧑‍🎓', desc: '기물 먹기 우선' },
  { key: 'genius', label: '천재 AI', emoji: '🧠', desc: '2수 앞 계산' },
  { key: 'robot', label: '로봇 AI', emoji: '🤖', desc: '3수 앞 계산' },
];

export default function PlayPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [playerSide, setPlayerSide] = useState<Player>('cho');
  const [aiLevel, setAiLevel] = useState<AiLevel>('baby');
  const [timerRunning, setTimerRunning] = useState(false);
  const [result, setResult] = useState<{ winner: Player; moveCount: number } | null>(null);
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
    setResult({ winner, moveCount });
    setPhase('ended');
    setTimerRunning(false);
  }, [moveCount]);

  const getResultMessage = () => {
    if (!result) return '';
    if (result.winner === playerSide) return '승리! 축하합니다!';
    return 'AI가 이겼습니다...';
  };

  const getResultEmoji = () => {
    if (!result) return '';
    if (result.winner === playerSide) return '🎉';
    return '😢';
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
            🤖 AI 대결
          </h2>

          {/* 진영 선택 */}
          <div>
            <h3 className="font-bold text-purple-600 mb-2">진영 선택</h3>
            <div className="flex gap-3">
              <button
                onClick={() => setPlayerSide('cho')}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all border-2 ${
                  playerSide === 'cho'
                    ? 'border-purple-500 bg-purple-100 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
                }`}
              >
                🟢 초(선공)
              </button>
              <button
                onClick={() => setPlayerSide('han')}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all border-2 ${
                  playerSide === 'han'
                    ? 'border-purple-500 bg-purple-100 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
                }`}
              >
                🔴 한(후공)
              </button>
            </div>
          </div>

          {/* AI 난이도 */}
          <div>
            <h3 className="font-bold text-purple-600 mb-2">AI 난이도</h3>
            <div className="grid grid-cols-2 gap-3">
              {AI_LEVELS.map(level => (
                <button
                  key={level.key}
                  onClick={() => setAiLevel(level.key)}
                  className={`p-3 rounded-xl text-left transition-all border-2 ${
                    aiLevel === level.key
                      ? 'border-purple-500 bg-purple-100'
                      : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{level.emoji}</div>
                  <div className="font-bold text-sm text-gray-800">{level.label}</div>
                  <div className="text-xs text-gray-500">{level.desc}</div>
                </button>
              ))}
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
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-purple-600">
            {AI_LEVELS.find(l => l.key === aiLevel)?.emoji}{' '}
            {AI_LEVELS.find(l => l.key === aiLevel)?.label}
          </span>
          <Timer running={timerRunning} />
        </div>
      </div>

      {/* Board */}
      <JanggiBoard
        key={gameKey}
        playerSide={playerSide}
        aiLevel={aiLevel}
        onGameEnd={handleGameEnd}
        onMove={setMoveCount}
      />

      {/* Result overlay */}
      {phase === 'ended' && result && (
        <>
          {result.winner === playerSide && <Confetti />}
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
            <div className="game-card text-center space-y-4 animate-bounce-in max-w-sm w-full">
              <div className="text-5xl">{getResultEmoji()}</div>
              <h2 className="text-2xl font-extrabold text-purple-700">
                {getResultMessage()}
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
