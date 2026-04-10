'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const AVATARS = ['😊', '🦊', '🐱', '🐶', '🐰', '🐼', '🦁', '🐸', '🐵', '🦄', '🐯', '🐮'];

interface Player {
  id: string;
  name: string;
  avatar_emoji: string;
  janggi_games_played: number;
  janggi_games_won: number;
  janggi_total_score: number;
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('😊');
  const [player, setPlayer] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAllPlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('*')
      .order('name');
    if (data) {
      data.sort((a, b) => (b.janggi_total_score ?? 0) - (a.janggi_total_score ?? 0));
      setAllPlayers(data);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const saved = localStorage.getItem('janggi_player_id');
    if (saved) {
      supabase.from('players').select('*').eq('id', saved).single().then(({ data, error: err }) => {
        if (!cancelled && data && !err) setPlayer(data);
      });
    }
    loadAllPlayers();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data: existing } = await supabase
        .from('players')
        .select('*')
        .eq('name', name.trim())
        .single();

      if (existing) {
        await supabase.from('players').update({ avatar_emoji: selectedAvatar }).eq('id', existing.id);
        existing.avatar_emoji = selectedAvatar;
        setPlayer(existing);
        localStorage.setItem('janggi_player_id', existing.id);
      } else {
        const { data: newPlayer, error: insertErr } = await supabase
          .from('players')
          .insert({ name: name.trim(), avatar_emoji: selectedAvatar })
          .select()
          .single();
        if (insertErr) throw insertErr;
        setPlayer(newPlayer);
        localStorage.setItem('janggi_player_id', newPlayer.id);
        loadAllPlayers();
      }
    } catch {
      setError('이름을 다시 확인해주세요!');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlayer = (p: Player) => {
    setPlayer(p);
    localStorage.setItem('janggi_player_id', p.id);
  };

  const handleLogout = () => {
    setPlayer(null);
    setName('');
    localStorage.removeItem('janggi_player_id');
  };

  // 로그인 전
  if (!player) {
    return (
      <div className="min-h-screen p-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="game-card text-center mb-4">
            <div className="text-6xl mb-3 animate-float">♜</div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-orange-500 via-pink-500 to-teal-500 bg-clip-text text-transparent mb-1">은우의 장기</h1>
            <p className="text-orange-400 mb-5 font-semibold">친구들과 함께 즐기는 장기!</p>

            <div className="mb-4">
              <p className="text-sm text-teal-600 mb-2 font-bold">캐릭터를 골라봐!</p>
              <div className="flex flex-wrap justify-center gap-2">
                {AVATARS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setSelectedAvatar(emoji)}
                    className={`text-2xl p-2 rounded-xl transition-all ${
                      selectedAvatar === emoji ? 'bg-orange-100 scale-125 shadow-lg ring-2 ring-orange-300' : 'hover:bg-orange-50 hover:scale-110'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="이름을 입력해줘! (예: 고은우)"
                className="w-full px-4 py-3 rounded-xl border-2 border-orange-200 focus:border-orange-500 focus:outline-none text-center text-lg font-bold"
                maxLength={10}
              />
            </div>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <button
              onClick={handleLogin}
              disabled={loading || !name.trim()}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? '접속 중...' : `${selectedAvatar} 시작하기!`}
            </button>
          </div>

          {allPlayers.length > 0 && (
            <div className="game-card">
              <h3 className="text-lg font-bold text-orange-600 mb-3 text-center">
                등록된 친구들 ({allPlayers.length}명)
              </h3>
              <p className="text-xs text-gray-400 text-center mb-3">이름을 눌러서 바로 접속!</p>
              <div className="space-y-2">
                {allPlayers.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPlayer(p)}
                    className="w-full text-left p-3 rounded-xl border-2 border-orange-100 hover:border-orange-400 hover:bg-orange-50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.avatar_emoji}</span>
                      <div className="flex-1">
                        <span className="font-bold text-gray-800">{p.name}</span>
                        {i === 0 && (p.janggi_total_score ?? 0) > 0 && <span className="ml-1 text-xs">👑</span>}
                        <div className="text-xs text-gray-400">
                          {p.janggi_games_played ?? 0}게임 | <span className="text-green-500 font-bold">{p.janggi_games_won ?? 0}승</span> | <span className="text-orange-500 font-bold">{p.janggi_total_score ?? 0}점</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 로그인 후 로비
  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="game-card mb-4">
          <div className="text-center mb-5">
            <div className="text-5xl mb-2 animate-float">{player.avatar_emoji}</div>
            <h2 className="text-2xl font-black text-gray-800">{player.name}</h2>
            <div className="flex justify-center gap-3 mt-2 text-sm text-gray-500">
              <span>{player.janggi_games_played ?? 0}게임</span>
              <span>|</span>
              <span className="text-green-500 font-bold">{player.janggi_games_won ?? 0}승</span>
              <span className="text-orange-500 font-extrabold">{player.janggi_total_score ?? 0}점</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={() => router.push('/play')} className="btn-primary w-full text-lg">
              🤖 AI 대결하기
            </button>

            <button onClick={() => router.push('/local')} className="btn-secondary w-full text-lg">
              👫 로컬 대전
            </button>

            <button
              onClick={() => router.push(`/room/new?player=${player.id}`)}
              className="w-full text-lg py-3 rounded-xl font-extrabold bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:from-pink-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              🏠 방 만들기
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && roomCode.trim() && router.push(`/room/${roomCode.trim()}?player=${player.id}`)}
                placeholder="방 코드"
                className="flex-1 px-4 py-3 rounded-xl border-2 border-orange-200 focus:border-orange-500 focus:outline-none text-center font-bold text-lg uppercase"
                maxLength={6}
              />
              <button
                onClick={() => roomCode.trim() && router.push(`/room/${roomCode.trim()}?player=${player.id}`)}
                disabled={!roomCode.trim()}
                className="btn-secondary disabled:opacity-50 px-6"
              >
                입장!
              </button>
            </div>
          </div>

          <button onClick={handleLogout} className="mt-4 text-sm text-gray-400 hover:text-orange-500 w-full text-center transition-colors">
            다른 이름으로 접속하기
          </button>
        </div>
      </div>
    </div>
  );
}
