'use client';

import { useState, useEffect, useCallback, useRef, Suspense, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Board, createInitialBoard, createInitialState, isInCheck } from '@/lib/janggi';
import JanggiBoard from '@/components/JanggiBoard';
import Timer from '@/components/Timer';
import Confetti from '@/components/Confetti';

interface PlayerData { id: string; name: string; avatar_emoji: string; }
interface Room {
  id: string; code: string; host_id: string; board: Board | null;
  turn: string; status: string; host_side: string; winner_id: string | null;
}
interface RoomPlayer { id: string; player_id: string; side: string; player?: PlayerData; }

function RoomContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const playerId = searchParams.get('player');

  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [hostSide, setHostSide] = useState<Player>('cho');
  const [gameStarted, setGameStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [gameResult, setGameResult] = useState<{ winner: Player } | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const roomIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 플레이어 로드
  useEffect(() => {
    if (!playerId) { router.push('/'); return; }
    supabase.from('players').select('*').eq('id', playerId).single().then(({ data, error: err }) => {
      if (err || !data) router.push('/');
      else setPlayer(data);
    });
  }, [playerId, router]);

  // 참가자 로드
  const loadPlayers = useCallback(async (rId: string) => {
    const { data, error: err } = await supabase.from('janggi_room_players').select('*').eq('room_id', rId);
    if (err || !data) return;
    const withPlayers = await Promise.all(
      data.map(async (rp) => {
        const { data: p } = await supabase.from('players').select('*').eq('id', rp.player_id).single();
        return { ...rp, player: p || undefined };
      })
    );
    setRoomPlayers(withPlayers);
  }, []);

  // DB에서 받은 데이터로 GameState 생성
  const buildGameState = useCallback((board: Board, turn: string, winnerId: string | null): GameState => {
    const turnPlayer = turn as Player;
    const state: GameState = {
      board,
      turn: turnPlayer,
      isCheck: isInCheck(board, turnPlayer),
      isCheckmate: !!winnerId,
      winner: null,
      moveHistory: [],
    };
    return state;
  }, []);

  // 방 참가
  useEffect(() => {
    if (!player) return;

    const setup = async () => {
      const { data: existingRoom, error: roomErr } = await supabase
        .from('janggi_rooms').select('*').eq('code', code.toUpperCase()).single();

      if (roomErr || !existingRoom) {
        setError('방을 찾을 수 없어요!');
        return;
      }

      roomIdRef.current = existingRoom.id;
      setRoom(existingRoom);
      setIsHost(existingRoom.host_id === player.id);
      setHostSide(existingRoom.host_side as Player);

      if (existingRoom.status === 'playing' && existingRoom.board) {
        setGameStarted(true);
        setGameState(buildGameState(existingRoom.board as Board, existingRoom.turn, existingRoom.winner_id));
      }

      // 게스트 참가
      if (existingRoom.host_id !== player.id) {
        const guestSide = existingRoom.host_side === 'cho' ? 'han' : 'cho';
        await supabase.from('janggi_room_players').upsert(
          { room_id: existingRoom.id, player_id: player.id, side: guestSide },
          { onConflict: 'room_id,player_id' }
        );
      }

      await loadPlayers(existingRoom.id);
    };

    setup();
  }, [player, code, loadPlayers, buildGameState]);

  // 실시간 구독 (폴링 제거 - Realtime만 사용)
  useEffect(() => {
    const rId = roomIdRef.current;
    if (!rId) return;

    // 이전 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`janggi-room-${rId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'janggi_room_players', filter: `room_id=eq.${rId}` },
        () => loadPlayers(rId))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'janggi_rooms', filter: `id=eq.${rId}` },
        (payload) => {
          const updated = payload.new as Room;
          setRoom(updated);
          if (updated.status === 'playing' && updated.board) {
            setGameStarted(true);
            setGameState(buildGameState(updated.board as Board, updated.turn, updated.winner_id));
          }
          if (updated.status === 'finished') {
            setCompleted(true);
            loadPlayers(rId);
          }
          if (updated.status === 'waiting') {
            // 다시 하기 시 대기 상태로 돌아옴
            setGameStarted(false);
            setCompleted(false);
            setGameResult(null);
            setGameState(null);
            setMoveCount(0);
          }
        })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdRef.current, loadPlayers, buildGameState]);

  // 게임 시작
  const handleStart = async () => {
    if (!room || !isHost || roomPlayers.length < 2) return;

    const guestSide = hostSide === 'cho' ? 'han' : 'cho';
    const guest = roomPlayers.find(rp => rp.player_id !== player?.id);
    if (guest) {
      await supabase.from('janggi_room_players').update({ side: guestSide }).eq('id', guest.id);
    }
    await supabase.from('janggi_room_players').update({ side: hostSide }).eq('room_id', room.id).eq('player_id', player?.id);

    const initialBoard = createInitialBoard();
    await supabase.from('janggi_rooms').update({
      status: 'playing',
      host_side: hostSide,
      board: initialBoard as unknown as Record<string, unknown>,
      turn: 'cho',
      winner_id: null,
      started_at: new Date().toISOString(),
    }).eq('id', room.id);
  };

  // 수 두기
  const handleBoardChange = useCallback(async (newState: GameState) => {
    if (!room || !player) return;

    const updateData: Record<string, unknown> = {
      board: newState.board as unknown as Record<string, unknown>,
      turn: newState.turn,
    };

    if (newState.winner) {
      const winnerRp = roomPlayers.find(rp => rp.side === newState.winner);
      if (winnerRp) {
        updateData.winner_id = winnerRp.player_id;
        updateData.status = 'finished';
      }
    }

    await supabase.from('janggi_rooms').update(updateData).eq('id', room.id);
    setMoveCount(c => c + 1);
  }, [room, player, roomPlayers]);

  // 게임 종료
  const handleGameEnd = useCallback(async (winner: Player) => {
    setGameResult({ winner });
    setCompleted(true);
    if (!room || !player) return;

    const winnerRp = roomPlayers.find(rp => rp.side === winner);
    const winnerId = winnerRp?.player_id || null;

    await supabase.from('janggi_rooms').update({ status: 'finished', winner_id: winnerId }).eq('id', room.id);

    for (const rp of roomPlayers) {
      const isWinner = rp.player_id === winnerId;
      const { data: p } = await supabase.from('players').select('janggi_games_played, janggi_games_won, janggi_total_score').eq('id', rp.player_id).single();
      if (p) {
        await supabase.from('players').update({
          janggi_games_played: (p.janggi_games_played ?? 0) + 1,
          ...(isWinner ? { janggi_games_won: (p.janggi_games_won ?? 0) + 1, janggi_total_score: (p.janggi_total_score ?? 0) + 100 } : {}),
        }).eq('id', rp.player_id);
      }
    }
  }, [room, player, roomPlayers]);

  // 다시 하기
  const handleRestart = async () => {
    if (!room || !isHost) return;
    await supabase.from('janggi_rooms').update({
      status: 'waiting',
      board: null,
      turn: 'cho',
      winner_id: null,
      started_at: null,
    }).eq('id', room.id);
  };

  // 방 코드 복사
  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="game-card text-center max-w-md">
          <div className="text-4xl mb-4">😢</div>
          <p className="text-lg text-gray-700 mb-4">{error}</p>
          <button onClick={() => router.push('/')} className="btn-primary">돌아가기</button>
        </div>
      </div>
    );
  }

  if (!room || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-orange-400 animate-pulse">방 준비 중... ♜</div>
      </div>
    );
  }

  const mySide = roomPlayers.find(rp => rp.player_id === player.id)?.side as Player || 'cho';

  // 결과 화면
  if (completed && (gameResult || room.winner_id)) {
    const winnerSide = gameResult?.winner || roomPlayers.find(rp => rp.player_id === room.winner_id)?.side as Player;
    const winnerPlayer = roomPlayers.find(rp => rp.side === winnerSide)?.player;
    const iWon = winnerSide === mySide;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        {iWon && <Confetti />}
        <div className="game-card w-full max-w-md text-center animate-bounce-in">
          <div className="text-6xl mb-4">{iWon ? '🏆' : '😢'}</div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent mb-2">
            {iWon ? '승리!' : '패배...'}
          </h2>
          <p className="text-gray-500 mb-2">
            {winnerSide === 'cho' ? '초(Green)' : '한(Red)'} 승리 | {moveCount}수
          </p>
          {winnerPlayer && (
            <p className="text-lg mb-4">{winnerPlayer.avatar_emoji} {winnerPlayer.name}(이)가 이겼어!</p>
          )}
          <div className="flex flex-col gap-2 mt-4">
            {isHost && (
              <button onClick={handleRestart} className="btn-primary w-full">
                다시 하기! 🔄
              </button>
            )}
            <button onClick={() => router.push('/')} className="btn-secondary w-full">로비로</button>
          </div>
        </div>
      </div>
    );
  }

  // 대기실
  if (!gameStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="game-card w-full max-w-md text-center">
          <div className="text-4xl mb-2">🏠</div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-orange-500 to-teal-500 bg-clip-text text-transparent mb-1">장기 대기실</h2>

          <div className="my-4 p-4 bg-orange-50 rounded-xl">
            <p className="text-sm text-gray-400 mb-1">방 코드를 친구에게 알려줘!</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-black text-orange-600 tracking-widest">{room.code}</span>
              <button onClick={copyCode} className="px-3 py-1 bg-orange-200 rounded-lg text-orange-700 text-sm font-bold hover:bg-orange-300">
                {copied ? '복사됨!' : '복사'}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2 font-semibold">참가자 ({roomPlayers.length}/2)</p>
            <div className="space-y-2">
              {roomPlayers.map(rp => (
                <div key={rp.id} className="flex items-center gap-3 p-2 bg-orange-50 rounded-xl">
                  <span className="text-2xl">{rp.player?.avatar_emoji}</span>
                  <span className="font-bold text-gray-800">{rp.player?.name}</span>
                  {rp.player_id === room.host_id && (
                    <span className="text-xs bg-yellow-200 text-yellow-700 px-2 py-0.5 rounded-full font-bold">방장</span>
                  )}
                </div>
              ))}
              {roomPlayers.length < 2 && (
                <div className="text-orange-300 animate-pulse p-2">상대를 기다리는 중...</div>
              )}
            </div>
          </div>

          {isHost && (
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2 font-semibold">진영 선택</p>
              <div className="flex gap-2 justify-center">
                {(['cho', 'han'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setHostSide(s)}
                    className={`px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                      hostSide === s ? 'bg-orange-500 text-white scale-105 shadow-md' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                    }`}
                  >
                    {s === 'cho' ? '🟢 초' : '🔴 한'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isHost ? (
            <button
              onClick={handleStart}
              disabled={roomPlayers.length < 2}
              className="btn-primary w-full text-lg disabled:opacity-50"
            >
              게임 시작! 🚀
            </button>
          ) : (
            <div className="text-orange-400 font-semibold animate-pulse">
              방장이 게임을 시작할 때까지 기다려줘...
            </div>
          )}

          <button onClick={() => router.push('/')} className="mt-3 text-sm text-gray-400 hover:text-orange-500 transition-colors">
            ← 나가기
          </button>
        </div>
      </div>
    );
  }

  // 게임 플레이
  return (
    <div className="min-h-screen p-2 sm:p-4 pt-4 sm:pt-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-orange-500">방: {room.code}</span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-600">
            {mySide === 'cho' ? '🟢 초' : '🔴 한'}
          </span>
          <Timer running={!completed} />
        </div>

        {/* 상대 정보 */}
        <div className="flex items-center justify-between mb-2 px-1">
          {roomPlayers.filter(rp => rp.player_id !== player.id).map(rp => (
            <div key={rp.id} className="flex items-center gap-2">
              <span className="text-lg">{rp.player?.avatar_emoji}</span>
              <span className="text-sm font-bold text-gray-800">{rp.player?.name}</span>
              <span className="text-xs text-gray-400">({rp.side === 'cho' ? '초' : '한'})</span>
            </div>
          ))}
        </div>

        {gameState && (
          <JanggiBoard
            playerSide={mySide}
            isOnlineMultiplayer
            externalGameState={gameState}
            onBoardChange={handleBoardChange}
            onGameEnd={handleGameEnd}
            onMove={setMoveCount}
          />
        )}

        {/* 내 정보 */}
        <div className="flex items-center gap-2 mt-2 px-1">
          <span className="text-lg">{player.avatar_emoji}</span>
          <span className="text-sm font-bold text-gray-800">{player.name}</span>
          <span className="text-xs text-gray-400">({mySide === 'cho' ? '초' : '한'})</span>
        </div>
      </div>
    </div>
  );
}

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-2xl text-purple-400">로딩 중... ♜</div></div>}>
      <RoomContent params={params} />
    </Suspense>
  );
}
