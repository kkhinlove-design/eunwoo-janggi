'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import JanggiBoard from '@/components/JanggiBoard';
import Timer from '@/components/Timer';
import Confetti from '@/components/Confetti';
import { supabase } from '@/lib/supabase';
import type { Player } from '@/lib/janggi';

type GamePhase = 'setup' | 'playing' | 'ended';

interface PlayerRow {
  id: string;
  name: string;
  avatar_emoji: string;
  janggi_games_played: number;
  janggi_games_won: number;
  janggi_total_score: number;
}

const WIN_REWARD = 100;

export default function LocalPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);
  const [choId, setChoId] = useState<string>('');
  const [hanId, setHanId] = useState<string>('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [result, setResult] = useState<{ winner: Player } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase.from('players').select('*').order('name').then(({ data }) => {
      if (cancelled || !data) return;
      setAllPlayers(data as PlayerRow[]);
      const saved = localStorage.getItem('janggi_player_id');
      if (saved && data.some(p => p.id === saved)) setChoId(saved);
    });
    return () => { cancelled = true; };
  }, []);

  const choPlayer = allPlayers.find(p => p.id === choId);
  const hanPlayer = allPlayers.find(p => p.id === hanId);

  const startGame = () => {
    if (!choId || !hanId) {
      setError('두 명의 플레이어를 모두 선택해주세요!');
      return;
    }
    if (choId === hanId) {
      setError('서로 다른 플레이어를 선택해주세요!');
      return;
    }
    setError('');
    setPhase('playing');
    setTimerRunning(true);
    setResult(null);
    setMoveCount(0);
    setGameKey(k => k + 1);
  };

  const handleGameEnd = useCallback(async (winner: Player) => {
    setResult({ winner });
    setPhase('ended');
    setTimerRunning(false);

    const winnerId = winner === 'cho' ? choId : hanId;
    const ids = [choId, hanId];
    for (const id of ids) {
      if (!id) continue;
      const { data: p } = await supabase
        .from('players')
        .select('janggi_games_played, janggi_games_won, janggi_total_score')
        .eq('id', id)
        .single();
      if (!p) continue;
      const isWinner = id === winnerId;
      await supabase.from('players').update({
        janggi_games_played: (p.janggi_games_played ?? 0) + 1,
        ...(isWinner
          ? {
              janggi_games_won: (p.janggi_games_won ?? 0) + 1,
              janggi_total_score: (p.janggi_total_score ?? 0) + WIN_REWARD,
            }
          : {}),
      }).eq('id', id);
    }
  }, [choId, hanId]);

  const getWinnerName = () => {
    if (!result) return '';
    if (result.winner === 'cho') return `${choPlayer?.name ?? '초'} 승리!`;
    return `${hanPlayer?.name ?? '한'} 승리!`;
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

          <h2 className="text-2xl font-black text-center bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent">
            👫 친구와 대결
          </h2>

          {allPlayers.length < 2 ? (
            <div className="text-center text-sm text-red-500 bg-red-50 rounded-xl py-3 px-4">
              친구가 2명 이상 등록돼야 해요.<br />
              홈 화면에서 친구를 등록해주세요!
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-bold text-green-600 mb-1 block">
                    🟢 초 플레이어 (선공)
                  </label>
                  <select
                    value={choId}
                    onChange={e => setChoId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-green-200 focus:border-green-500 outline-none font-semibold bg-white"
                  >
                    <option value="">친구 선택...</option>
                    {allPlayers.map(p => (
                      <option key={p.id} value={p.id} disabled={p.id === hanId}>
                        {p.avatar_emoji} {p.name} ({p.janggi_total_score ?? 0}점)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-red-500 mb-1 block">
                    🔴 한 플레이어 (후공)
                  </label>
                  <select
                    value={hanId}
                    onChange={e => setHanId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-red-200 focus:border-red-500 outline-none font-semibold bg-white"
                  >
                    <option value="">친구 선택...</option>
                    {allPlayers.map(p => (
                      <option key={p.id} value={p.id} disabled={p.id === choId}>
                        {p.avatar_emoji} {p.name} ({p.janggi_total_score ?? 0}점)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-center text-gray-500">
                이긴 사람에게 +{WIN_REWARD}점, 진 사람도 1게임 기록!
              </p>

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              <button onClick={startGame} className="btn-primary w-full py-4 text-lg">
                게임 시작!
              </button>
            </>
          )}
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
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-gray-600">
            <span className="text-green-600">{choPlayer?.avatar_emoji} {choPlayer?.name ?? '초'}</span>
            {' vs '}
            <span className="text-red-500">{hanPlayer?.avatar_emoji} {hanPlayer?.name ?? '한'}</span>
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
              <h2 className="text-2xl font-black bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                {getWinnerName()}
              </h2>
              <p className="text-gray-500 text-sm">
                {result.winner === 'cho' ? '초(Green)' : '한(Red)'} 승리 | {moveCount}수
              </p>
              <p className="text-orange-500 font-extrabold text-lg">+{WIN_REWARD}점 획득!</p>
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
