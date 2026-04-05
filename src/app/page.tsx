'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface PlayerRecord {
  id: string;
  name: string;
  avatar_emoji: string;
  janggi_games_played: number;
  janggi_games_won: number;
  janggi_total_score: number;
}

export default function Home() {
  const [name, setName] = useState('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [savedName, setSavedName] = useState('');
  const [recentPlayers, setRecentPlayers] = useState<PlayerRecord[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedId = localStorage.getItem('janggi-player-id');
    const storedName = localStorage.getItem('janggi-player-name');
    if (storedId && storedName) {
      setPlayerId(storedId);
      setName(storedName);
      setSavedName(storedName);
    }
    loadRecentPlayers();
  }, []);

  const loadRecentPlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('*')
      .order('janggi_total_score', { ascending: false })
      .limit(10);
    if (data) setRecentPlayers(data);
  };

  const saveName = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      // First, try to find existing player by name
      const { data: existing } = await supabase
        .from('players')
        .select()
        .eq('name', name.trim())
        .single();

      let data;
      if (existing) {
        data = existing;
      } else {
        // Not found, insert new player
        const { data: inserted, error } = await supabase
          .from('players')
          .insert({ name: name.trim() })
          .select()
          .single();
        if (error) throw error;
        data = inserted;
      }

      if (data) {
        setPlayerId(data.id);
        setSavedName(data.name);
        localStorage.setItem('janggi-player-id', data.id);
        localStorage.setItem('janggi-player-name', data.name);
        loadRecentPlayers();
      }
    } catch {
      // If insert fails, try to fetch existing
      const { data } = await supabase
        .from('players')
        .select()
        .eq('name', name.trim())
        .single();
      if (data) {
        setPlayerId(data.id);
        setSavedName(data.name);
        localStorage.setItem('janggi-player-id', data.id);
        localStorage.setItem('janggi-player-name', data.name);
      }
    }
    setIsLoading(false);
  };

  const quickLogin = (player: PlayerRecord) => {
    setName(player.name);
    setPlayerId(player.id);
    setSavedName(player.name);
    localStorage.setItem('janggi-player-id', player.id);
    localStorage.setItem('janggi-player-name', player.name);
  };

  const isLoggedIn = !!playerId && !!savedName;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">&#9823;</div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          은우의 장기
        </h1>
        <p className="text-gray-500 mb-6 text-sm">Korean Chess (Janggi)</p>

        {/* Player name */}
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
            />
            <button
              onClick={saveName}
              disabled={isLoading}
              className="btn-primary text-sm !py-2 !px-3"
            >
              {isLoading ? '...' : '저장'}
            </button>
          </div>
          {savedName && (
            <p className="text-green-600 text-xs mt-1">
              안녕하세요, {savedName}님!
            </p>
          )}
        </div>

        {/* Recent players for quick login */}
        {!isLoggedIn && recentPlayers.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-gray-500 mb-2">등록된 플레이어</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {recentPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => quickLogin(p)}
                  className="px-3 py-1 bg-gray-100 hover:bg-purple-100 rounded-full text-sm text-gray-700 transition-colors"
                >
                  {p.avatar_emoji} {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu */}
        <div className="flex flex-col gap-3">
          <Link href="/play" className="btn-primary text-center text-lg">
            🤖 혼자 연습하기 (AI 대전)
          </Link>
          <Link href="/local" className="btn-secondary text-center text-lg">
            👫 친구와 대결 (로컬 대전)
          </Link>

          {/* Online multiplayer section */}
          {isLoggedIn && (
            <>
              <div className="border-t pt-3 mt-1">
                <p className="text-xs text-gray-500 mb-3">온라인 대전</p>
                <Link
                  href={`/room/new?player=${playerId}`}
                  className="block w-full text-center text-lg py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg"
                >
                  🏠 방 만들기
                </Link>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="방 코드 (4자리)"
                  maxLength={4}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm text-center font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-purple-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && roomCode.length === 4) {
                      window.location.href = `/room/${roomCode}?player=${playerId}`;
                    }
                  }}
                />
                <Link
                  href={roomCode.length === 4 ? `/room/${roomCode}?player=${playerId}` : '#'}
                  className={`btn-secondary text-sm !py-2 !px-4 ${
                    roomCode.length !== 4 ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  입장
                </Link>
              </div>
            </>
          )}

          {!isLoggedIn && (
            <p className="text-xs text-gray-400 mt-2">
              온라인 대전을 하려면 먼저 이름을 저장하세요
            </p>
          )}
        </div>

        {/* Rules summary */}
        <div className="mt-6 text-left text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          <p className="font-semibold text-gray-700 mb-1">장기 규칙 요약</p>
          <ul className="space-y-0.5">
            <li>궁 - 궁성 안에서 한 칸 이동</li>
            <li>車 - 직선 무한 이동</li>
            <li>包 - 하나를 뛰어넘어 이동 (포끼리 불가)</li>
            <li>馬 - 날 일(日)자 이동 (막힘 있음)</li>
            <li>象 - 날 용(用)자 이동 (막힘 있음)</li>
            <li>士 - 궁성 안에서 한 칸 이동</li>
            <li>卒/兵 - 앞 또는 옆으로 한 칸</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
