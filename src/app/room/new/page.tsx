'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function NewRoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const playerId = searchParams.get('player');

  useEffect(() => {
    if (!playerId) { router.push('/'); return; }

    const create = async () => {
      const code = generateCode();
      const { data: room, error } = await supabase.from('janggi_rooms').insert({
        code,
        host_id: playerId,
        status: 'waiting',
        host_side: 'cho',
        turn: 'cho',
      }).select().single();

      if (error || !room) { router.push('/'); return; }

      await supabase.from('janggi_room_players').insert({
        room_id: room.id,
        player_id: playerId,
        side: 'cho',
      });

      router.replace(`/room/${code}?player=${playerId}`);
    };

    create();
  }, [playerId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-2xl text-orange-400 animate-pulse">방 만드는 중... ♜</div>
    </div>
  );
}

export default function NewRoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-2xl text-orange-400 animate-pulse">로딩 중...</div></div>}>
      <NewRoomContent />
    </Suspense>
  );
}
