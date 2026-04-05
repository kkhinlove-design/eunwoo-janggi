'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Suspense } from 'react';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function CreateRoomInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');

  const playerId = searchParams.get('player');

  useEffect(() => {
    if (!playerId) {
      router.replace('/');
      return;
    }

    const createRoom = async () => {
      const code = generateRoomCode();

      const { data: room, error: roomErr } = await supabase
        .from('janggi_rooms')
        .insert({
          code,
          host_id: playerId,
          status: 'waiting',
          host_side: 'cho',
          turn: 'cho',
        })
        .select()
        .single();

      if (roomErr || !room) {
        setError('방 생성 실패: ' + (roomErr?.message || 'Unknown error'));
        return;
      }

      // Add host to room_players
      await supabase.from('janggi_room_players').insert({
        room_id: room.id,
        player_id: playerId,
        side: 'cho',
      });

      router.replace(`/room/${code}?player=${playerId}`);
    };

    createRoom();
  }, [playerId, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => router.push('/')} className="btn-primary">
            메인으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4 animate-spin">&#9823;</div>
        <p className="text-gray-600">방을 만들고 있습니다...</p>
      </div>
    </div>
  );
}

export default function CreateRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-white">로딩 중...</p>
        </div>
      }
    >
      <CreateRoomInner />
    </Suspense>
  );
}
