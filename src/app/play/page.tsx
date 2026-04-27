'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import JanggiBoard from '@/components/JanggiBoard';
import Timer from '@/components/Timer';
import Confetti from '@/components/Confetti';
import { supabase } from '@/lib/supabase';
import type { Player } from '@/lib/janggi';
import type { AiLevel } from '@/lib/janggi-ai';

type GamePhase = 'setup' | 'playing' | 'ended';

interface PlayerRow {
  id: string;
  name: string;
  avatar_emoji: string;
  janggi_games_played: number;
  janggi_games_won: number;
  janggi_total_score: number;
}

const AI_LEVELS: { key: AiLevel; label: string; emoji: string; desc: string; color: string; reward: number }[] = [
  { key: 'baby', label: '아기 AI', emoji: '👶', desc: '랜덤으로 둬요', color: 'from-green-400 to-emerald-500', reward: 50 },
  { key: 'student', label: '학생 AI', emoji: '🧑‍🎓', desc: '기물 먹기 우선', color: 'from-blue-400 to-cyan-500', reward: 100 },
  { key: 'genius', label: '천재 AI', emoji: '🧠', desc: '2수 앞 계산!', color: 'from-purple-400 to-pink-500', reward: 150 },
  { key: 'robot', label: '로봇 AI', emoji: '🤖', desc: '3수 앞 계산!!', color: 'from-red-400 to-orange-500', reward: 200 },
];

export default function PlayPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [playerSide, setPlayerSide] = useState<Player>('cho');
  const [aiLevel, setAiLevel] = useState<AiLevel>('baby');
  const [timerRunning, setTimerRunning] = useState(false);
  const [result, setResult] = useState<{ winner: Player; moveCount: number; reward: number } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [me, setMe] = useState<PlayerRow | null>(null);

  const moveCountRef = useRef(moveCount);
  moveCountRef.current = moveCount;

  // 로그인된 player 로드 (홈에서 저장한 localStorage 값)
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('janggi_player_id') : null;
    if (!saved) return;
    let cancelled = false;
    supabase.from('players').select('*').eq('id', saved).single().then(({ data }) => {
      if (!cancelled && data) setMe(data as PlayerRow);
    });
    return () => { cancelled = true; };
  }, []);

  const startGame = () => {
    setPhase('playing');
    setTimerRunning(true);
    setResult(null);
    setMoveCount(0);
    setGameKey(k => k + 1);
  };

  const handleGameEnd = useCallback(async (winner: Player) => {
    const isWin = winner === playerSide;
    const reward = isWin ? (AI_LEVELS.find(l => l.key === aiLevel)?.reward ?? 100) : 0;
    setResult({ winner, moveCount: moveCountRef.current, reward });
    setPhase('ended');
    setTimerRunning(false);

    if (!me) return;
    const { data: p } = await supabase
      .from('players')
      .select('janggi_games_played, janggi_games_won, janggi_total_score')
      .eq('id', me.id)
      .single();
    if (!p) return;
    await supabase.from('players').update({
      janggi_games_played: (p.janggi_games_played ?? 0) + 1,
      ...(isWin
        ? {
            janggi_games_won: (p.janggi_games_won ?? 0) + 1,
            janggi_total_score: (p.janggi_total_score ?? 0) + reward,
          }
        : {}),
    }).eq('id', me.id);
  }, [playerSide, aiLevel, me]);

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
            className="text-orange-500 text-sm font-bold hover:text-orange-700 transition-colors"
          >
            &larr; 돌아가기
          </button>

          <h2 className="text-2xl font-black text-center bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
            🤖 AI 대결
          </h2>

          {me ? (
            <div className="text-center text-sm bg-orange-50 rounded-xl py-2 px-3">
              <span className="text-xl mr-1">{me.avatar_emoji}</span>
              <span className="font-bold text-gray-800">{me.name}</span>
              <span className="text-gray-500"> · 이기면 점수가 올라가요!</span>
            </div>
          ) : (
            <div className="text-center text-xs text-red-500 bg-red-50 rounded-xl py-2 px-3">
              로그인이 안 돼있어요. 홈에서 이름을 먼저 등록해주세요.
            </div>
          )}

          {/* 진영 선택 */}
          <div>
            <h3 className="font-bold text-teal-600 mb-2">진영 선택</h3>
            <div className="flex gap-3">
              <button
                onClick={() => setPlayerSide('cho')}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all border-2 ${
                  playerSide === 'cho'
                    ? 'border-green-400 bg-green-50 text-green-700 shadow-md scale-105'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                }`}
              >
                🟢 초(선공)
              </button>
              <button
                onClick={() => setPlayerSide('han')}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all border-2 ${
                  playerSide === 'han'
                    ? 'border-red-400 bg-red-50 text-red-700 shadow-md scale-105'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-red-300'
                }`}
              >
                🔴 한(후공)
              </button>
            </div>
          </div>

          {/* AI 난이도 */}
          <div>
            <h3 className="font-bold text-teal-600 mb-2">AI 난이도 (이기면 점수!)</h3>
            <div className="grid grid-cols-2 gap-3">
              {AI_LEVELS.map(level => (
                <button
                  key={level.key}
                  onClick={() => setAiLevel(level.key)}
                  className={`p-3 rounded-xl text-left transition-all border-2 ${
                    aiLevel === level.key
                      ? 'border-orange-400 bg-orange-50 shadow-md scale-105'
                      : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm'
                  }`}
                >
                  <div className="text-2xl mb-1">{level.emoji}</div>
                  <div className="font-bold text-sm text-gray-800">{level.label}</div>
                  <div className="text-xs text-gray-500">{level.desc}</div>
                  <div className="text-xs font-bold text-orange-500 mt-1">+{level.reward}점</div>
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
          className="text-orange-500 text-sm font-bold hover:text-orange-700 transition-colors"
        >
          &larr; 설정
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold px-3 py-1 rounded-full bg-gradient-to-r ${AI_LEVELS.find(l => l.key === aiLevel)?.color} text-white`}>
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
              <h2 className="text-2xl font-black bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                {getResultMessage()}
              </h2>
              <p className="text-gray-500 text-sm">
                {result.winner === 'cho' ? '초(Green)' : '한(Red)'} 승리 | {result.moveCount}수
              </p>
              {me && result.reward > 0 && (
                <p className="text-orange-500 font-extrabold text-lg">+{result.reward}점 획득!</p>
              )}
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
