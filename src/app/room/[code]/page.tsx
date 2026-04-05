'use client';

import { use, useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Board, createInitialBoard, createInitialState, makeMove, isInCheck, isCheckmate as checkCheckmate } from '@/lib/janggi';
import JanggiBoard from '@/components/JanggiBoard';
import Timer from '@/components/Timer';
import Confetti from '@/components/Confetti';

interface RoomData {
  id: string;
  code: string;
  host_id: string;
  board: Board | null;
  turn: string;
  status: string;
  host_side: string;
  winner_id: string | null;
  started_at: string | null;
}

interface RoomPlayer {
  id: string;
  room_id: string;
  player_id: string;
  side: string;
  player?: { id: string; name: string; avatar_emoji: string };
}

function RoomInner({ code }: { code: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const playerId = searchParams.get('player');

  const [room, setRoom] = useState<RoomData | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [winnerName, setWinnerName] = useState('');
  const [moveCount, setMoveCount] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const myPlayer = players.find((p) => p.player_id === playerId);
  const mySide = myPlayer?.side as Player | undefined;
  const isHost = room?.host_id === playerId;
  const opponentJoined = players.length >= 2;

  // Load room data
  const loadRoom = useCallback(async () => {
    const { data: roomData, error: roomErr } = await supabase
      .from('janggi_rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (roomErr || !roomData) {
      setError('방을 찾을 수 없습니다');
      return;
    }

    setRoom(roomData);

    // Load players with names
    const { data: roomPlayers } = await supabase
      .from('janggi_room_players')
      .select('*, player:players(id, name, avatar_emoji)')
      .eq('room_id', roomData.id);

    if (roomPlayers) {
      // Flatten the player relation
      const mapped = roomPlayers.map((rp: Record<string, unknown>) => ({
        ...rp,
        player: Array.isArray(rp.player) ? rp.player[0] : rp.player,
      })) as RoomPlayer[];
      setPlayers(mapped);
    }

    // If game is playing, rebuild game state from board
    if (roomData.status === 'playing' && roomData.board) {
      const state: GameState = {
        board: roomData.board as Board,
        turn: roomData.turn as Player,
        isCheck: isInCheck(roomData.board as Board, roomData.turn as Player),
        isCheckmate: false,
        winner: null,
        moveHistory: [],
      };
      setGameState(state);
      if (roomData.winner_id) {
        // Find winner side
        const winnerPlayer = roomPlayers?.find(
          (rp: Record<string, unknown>) => rp.player_id === roomData.winner_id
        );
        if (winnerPlayer) {
          setWinner(winnerPlayer.side as Player);
          const wp = Array.isArray(winnerPlayer.player) ? winnerPlayer.player[0] : winnerPlayer.player;
          setWinnerName((wp as { name: string })?.name || '');
        }
      }
    }

    if (roomData.status === 'finished' && roomData.winner_id) {
      const winnerPlayer = roomPlayers?.find(
        (rp: Record<string, unknown>) => rp.player_id === roomData.winner_id
      );
      if (winnerPlayer) {
        setWinner(winnerPlayer.side as Player);
        const wp = Array.isArray(winnerPlayer.player) ? winnerPlayer.player[0] : winnerPlayer.player;
        setWinnerName((wp as { name: string })?.name || '');
      }
    }
  }, [code]);

  // Join room as guest
  useEffect(() => {
    if (!room || !playerId || isHost) return;
    if (players.some((p) => p.player_id === playerId)) return;
    if (room.status !== 'waiting') return;

    const joinRoom = async () => {
      const guestSide = room.host_side === 'cho' ? 'han' : 'cho';
      await supabase.from('janggi_room_players').upsert(
        { room_id: room.id, player_id: playerId, side: guestSide },
        { onConflict: 'room_id,player_id' }
      );
      loadRoom();
    };
    joinRoom();
  }, [room, playerId, isHost, players, loadRoom]);

  // Initial load
  useEffect(() => {
    if (!playerId) {
      router.replace('/');
      return;
    }
    loadRoom();
  }, [playerId, router, loadRoom]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!room) return;

    const roomChannel = supabase
      .channel(`room-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'janggi_rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as RoomData;
          setRoom(updated);

          if (updated.status === 'playing' && updated.board) {
            const state: GameState = {
              board: updated.board as Board,
              turn: updated.turn as Player,
              isCheck: isInCheck(updated.board as Board, updated.turn as Player),
              isCheckmate: false,
              winner: null,
              moveHistory: [],
            };

            // Check for checkmate/winner
            if (updated.winner_id) {
              state.isCheckmate = true;
              const wp = players.find((p) => p.player_id === updated.winner_id);
              if (wp) {
                state.winner = wp.side as Player;
                setWinner(wp.side as Player);
                setWinnerName(wp.player?.name || '');
              }
            }

            setGameState(state);
          }

          if (updated.status === 'finished') {
            loadRoom();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'janggi_room_players', filter: `room_id=eq.${room.id}` },
        () => {
          loadRoom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [room?.id, players, loadRoom]);

  // Host picks side
  const pickSide = async (side: Player) => {
    if (!room || !isHost) return;
    await supabase
      .from('janggi_rooms')
      .update({ host_side: side })
      .eq('id', room.id);

    // Update room_players sides
    await supabase
      .from('janggi_room_players')
      .update({ side })
      .eq('room_id', room.id)
      .eq('player_id', playerId);

    // Update guest side (opposite)
    const guestSide = side === 'cho' ? 'han' : 'cho';
    const guest = players.find((p) => p.player_id !== playerId);
    if (guest) {
      await supabase
        .from('janggi_room_players')
        .update({ side: guestSide })
        .eq('room_id', room.id)
        .eq('player_id', guest.player_id);
    }

    loadRoom();
  };

  // Host starts game
  const startGame = async () => {
    if (!room || !isHost || !opponentJoined) return;
    const initialBoard = createInitialBoard();
    await supabase
      .from('janggi_rooms')
      .update({
        status: 'playing',
        board: initialBoard as unknown as Record<string, unknown>,
        turn: 'cho',
        started_at: new Date().toISOString(),
      })
      .eq('id', room.id);
  };

  // Handle board change from JanggiBoard
  const handleBoardChange = async (newState: GameState) => {
    if (!room || !mySide) return;

    // Update room in Supabase
    const updateData: Record<string, unknown> = {
      board: newState.board as unknown as Record<string, unknown>,
      turn: newState.turn,
    };

    if (newState.winner) {
      // Find the winner's player_id
      const winnerPlayerRecord = players.find((p) => p.side === newState.winner);
      if (winnerPlayerRecord) {
        updateData.winner_id = winnerPlayerRecord.player_id;
        updateData.status = 'finished';
      }
    }

    await supabase
      .from('janggi_rooms')
      .update(updateData)
      .eq('id', room.id);

    setMoveCount((c) => c + 1);
  };

  const handleGameEnd = (w: Player) => {
    setWinner(w);
    const wp = players.find((p) => p.side === w);
    if (wp) setWinnerName(wp.player?.name || '');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRematch = async () => {
    if (!room || !isHost) return;
    const initialBoard = createInitialBoard();
    await supabase
      .from('janggi_rooms')
      .update({
        status: 'playing',
        board: initialBoard as unknown as Record<string, unknown>,
        turn: 'cho',
        winner_id: null,
        started_at: new Date().toISOString(),
      })
      .eq('id', room.id);
    setWinner(null);
    setWinnerName('');
    setMoveCount(0);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Link href="/" className="btn-primary">
            메인으로
          </Link>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4 animate-pulse">&#9823;</div>
          <p className="text-gray-600">방을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // WAITING ROOM
  if (room.status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <Link href="/" className="text-purple-600 text-sm hover:underline mb-4 inline-block">
            &larr; 메인으로
          </Link>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">대기실</h2>

          {/* Room code */}
          <div className="mb-6">
            <p className="text-xs text-gray-500 mb-1">방 코드</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-mono font-bold tracking-widest text-purple-600">
                {room.code}
              </span>
              <button
                onClick={copyCode}
                className="text-sm px-2 py-1 bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors"
              >
                {copied ? '복사됨!' : '복사'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">이 코드를 상대방에게 알려주세요</p>
          </div>

          {/* Players */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">참가자</p>
            <div className="space-y-2">
              {players.map((rp) => (
                <div
                  key={rp.id}
                  className={`flex items-center justify-between px-4 py-2 rounded-lg ${
                    rp.side === 'cho' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <span className="font-medium text-gray-700">
                    {rp.player?.avatar_emoji} {rp.player?.name || '???'}
                    {rp.player_id === room.host_id && (
                      <span className="ml-1 text-xs text-purple-500">(방장)</span>
                    )}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      rp.side === 'cho' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {rp.side === 'cho' ? '초 (Green)' : '한 (Red)'}
                  </span>
                </div>
              ))}
              {players.length < 2 && (
                <div className="px-4 py-2 rounded-lg bg-gray-50 border border-dashed border-gray-300 text-gray-400 text-sm">
                  상대방 대기 중...
                </div>
              )}
            </div>
          </div>

          {/* Host controls */}
          {isHost && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-2">진영 선택 (방장)</p>
              <div className="flex gap-3">
                <button
                  onClick={() => pickSide('cho')}
                  className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                    room.host_side === 'cho'
                      ? 'bg-green-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  초 (Green)
                  <div className="text-xs font-normal mt-0.5">선공</div>
                </button>
                <button
                  onClick={() => pickSide('han')}
                  className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                    room.host_side === 'han'
                      ? 'bg-red-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  한 (Red)
                  <div className="text-xs font-normal mt-0.5">후공</div>
                </button>
              </div>
            </div>
          )}

          {isHost && (
            <button
              onClick={startGame}
              disabled={!opponentJoined}
              className={`btn-primary w-full text-lg ${
                !opponentJoined ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {opponentJoined ? '게임 시작!' : '상대방을 기다리는 중...'}
            </button>
          )}

          {!isHost && (
            <div className="text-gray-500 text-sm animate-pulse">
              방장이 게임을 시작하길 기다리는 중...
            </div>
          )}
        </div>
      </div>
    );
  }

  // PLAYING / FINISHED
  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      {winner && <Confetti />}
      <div className="w-full max-w-[600px]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <Link href="/" className="text-white/80 text-sm hover:underline">
            &larr; 메인
          </Link>
          <div className="text-white/60 text-xs font-mono">
            방 코드: {room.code}
          </div>
          <Timer isRunning={!winner && room.status === 'playing'} label="경과 시간" />
          <div className="text-white/80 text-sm">수: {moveCount}</div>
        </div>

        {/* Player indicators */}
        <div className="flex justify-between items-center mb-2 px-1">
          {players.map((rp) => (
            <div
              key={rp.id}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                gameState?.turn === rp.side
                  ? rp.side === 'cho'
                    ? 'bg-green-600 text-white font-bold'
                    : 'bg-red-600 text-white font-bold'
                  : 'bg-white/20 text-white/70'
              }`}
            >
              {rp.player?.avatar_emoji} {rp.player?.name}
              {rp.player_id === playerId && ' (나)'}
              {gameState?.turn === rp.side && ' - 차례'}
            </div>
          ))}
        </div>

        {gameState && mySide && (
          <JanggiBoard
            playerSide={mySide}
            isOnlineMultiplayer
            externalGameState={gameState}
            onBoardChange={handleBoardChange}
            onGameEnd={handleGameEnd}
            onMove={setMoveCount}
          />
        )}

        {/* Game over */}
        {(winner || room.status === 'finished') && (
          <div className="card p-6 mt-4 text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {winner === mySide ? '축하합니다! 승리!' : '아쉽지만 패배...'}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {winnerName && `${winnerName}님 `}
              ({winner === 'cho' ? '초 Green' : '한 Red'}) 승리 | {moveCount}수
            </p>
            <div className="flex gap-3 justify-center">
              {isHost && (
                <button onClick={handleRematch} className="btn-primary">
                  재대결
                </button>
              )}
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

function RoomPageContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-white">로딩 중...</p>
        </div>
      }
    >
      <RoomInner code={code.toUpperCase()} />
    </Suspense>
  );
}

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-white">로딩 중...</p>
        </div>
      }
    >
      <RoomPageContent params={params} />
    </Suspense>
  );
}
