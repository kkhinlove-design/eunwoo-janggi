'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  Player,
  Piece,
  createInitialState,
  getValidMoves,
  makeMove,
  getPieceChar,
} from '@/lib/janggi';
import { AiLevel, getAiMove } from '@/lib/janggi-ai';

interface JanggiBoardProps {
  playerSide?: Player;
  aiLevel?: AiLevel;
  isLocalMultiplayer?: boolean;
  onGameEnd?: (winner: Player) => void;
  onMove?: (moveCount: number) => void;
  externalGameState?: GameState | null;
  onBoardChange?: (newState: GameState) => void;
  isOnlineMultiplayer?: boolean;
}

export default function JanggiBoard({
  playerSide = 'cho',
  aiLevel,
  isLocalMultiplayer = false,
  onGameEnd,
  onMove,
  externalGameState,
  onBoardChange,
  isOnlineMultiplayer = false,
}: JanggiBoardProps) {
  const [internalGameState, setInternalGameState] = useState<GameState>(createInitialState());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [lastMove, setLastMove] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef(internalGameState);
  gameStateRef.current = internalGameState;

  const gameState = (isOnlineMultiplayer && externalGameState) ? externalGameState : internalGameState;

  useEffect(() => {
    if (isOnlineMultiplayer && externalGameState) {
      setSelected(null);
      setValidMoves([]);
    }
  }, [isOnlineMultiplayer, externalGameState]);

  const flipped = playerSide === 'han' && !isLocalMultiplayer;
  const isPlayerTurn = isLocalMultiplayer || gameState.turn === playerSide;

  const scheduleAiMove = useCallback((currentState: GameState) => {
    if (isOnlineMultiplayer || isLocalMultiplayer || !aiLevel || currentState.winner) return;
    if (currentState.turn === playerSide) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setIsAiThinking(true);
    timerRef.current = setTimeout(() => {
      const move = getAiMove(currentState, aiLevel);
      if (move) {
        const newState = makeMove(currentState, move.from, move.to);
        if (isOnlineMultiplayer) {
          onBoardChange?.(newState);
        } else {
          setInternalGameState(newState);
        }
        setLastMove({ from: move.from, to: move.to });
        onMove?.(newState.moveHistory.length);
        if (newState.winner) {
          onGameEnd?.(newState.winner);
        }
      }
      setIsAiThinking(false);
      timerRef.current = null;
    }, 400 + Math.random() * 600);
  }, [aiLevel, playerSide, isOnlineMultiplayer, isLocalMultiplayer, onBoardChange, onMove, onGameEnd]);

  // AI goes first (e.g., player is 'han')
  useEffect(() => {
    if (!isPlayerTurn && aiLevel && !gameState.winner && !isOnlineMultiplayer) {
      scheduleAiMove(gameState);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (gameState.winner || !isPlayerTurn || isAiThinking) return;

      const boardRow = flipped ? 9 - row : row;
      const boardCol = flipped ? 8 - col : col;

      const piece = gameState.board[boardRow][boardCol];

      if (selected) {
        const isValidTarget = validMoves.some(([r, c]) => r === boardRow && c === boardCol);
        if (isValidTarget) {
          const newState = makeMove(gameState, selected, [boardRow, boardCol]);
          if (isOnlineMultiplayer) {
            onBoardChange?.(newState);
          } else {
            setInternalGameState(newState);
          }
          setLastMove({ from: selected, to: [boardRow, boardCol] });
          setSelected(null);
          setValidMoves([]);
          onMove?.(newState.moveHistory.length);
          if (newState.winner) {
            onGameEnd?.(newState.winner);
          } else {
            scheduleAiMove(newState);
          }
          return;
        }
      }

      if (piece && piece.player === gameState.turn) {
        setSelected([boardRow, boardCol]);
        const moves = getValidMoves(gameState, boardRow, boardCol);
        setValidMoves(moves);
      } else {
        setSelected(null);
        setValidMoves([]);
      }
    },
    [gameState, selected, validMoves, flipped, isPlayerTurn, isAiThinking, isOnlineMultiplayer, onBoardChange, onGameEnd, onMove, scheduleAiMove]
  );

  const renderPiece = (piece: Piece | null, boardRow: number, boardCol: number) => {
    if (!piece) return null;

    const isSelected = selected && selected[0] === boardRow && selected[1] === boardCol;
    const isKingInCheck =
      gameState.isCheck && piece.type === 'king' && piece.player === gameState.turn;

    return (
      <div
        className={`piece ${piece.player === 'cho' ? 'piece-cho' : 'piece-han'} ${
          isSelected ? 'selected' : ''
        } ${isKingInCheck ? 'check-indicator' : ''}`}
      >
        {getPieceChar(piece)}
      </div>
    );
  };

  const isValidMoveTarget = (boardRow: number, boardCol: number) => {
    return validMoves.some(([r, c]) => r === boardRow && c === boardCol);
  };

  const isLastMoveCell = (boardRow: number, boardCol: number) => {
    if (!lastMove) return false;
    return (
      (lastMove.from[0] === boardRow && lastMove.from[1] === boardCol) ||
      (lastMove.to[0] === boardRow && lastMove.to[1] === boardCol)
    );
  };

  const rows = Array.from({ length: 10 }, (_, i) => i);
  const cols = Array.from({ length: 9 }, (_, i) => i);

  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl mx-auto">
      {/* Status */}
      <div className="text-center">
        {isAiThinking && (
          <span className="text-orange-500 font-bold animate-pulse">
            🤖 AI가 생각 중...
          </span>
        )}
        {gameState.isCheck && !gameState.winner && (
          <span className="text-red-500 font-extrabold text-lg">⚡ 장군!</span>
        )}
        {!isOnlineMultiplayer && !gameState.winner && !isAiThinking && !gameState.isCheck && (
          <span className="text-teal-600 font-bold">
            {isLocalMultiplayer
              ? `${gameState.turn === 'cho' ? '🟢 초' : '🔴 한'}의 차례입니다`
              : isPlayerTurn
                ? '당신의 차례입니다'
                : ''
            }
          </span>
        )}
      </div>

      {/* Board */}
      <div className="relative" style={{ width: 'min(95vw, 560px)', margin: '0 auto' }}>
        <div
          className="relative w-full"
          style={{
            paddingBottom: `${(10 / 9) * 100}%`,
            background: 'linear-gradient(180deg, #e8c97a 0%, #d4a84b 100%)',
            borderRadius: '16px',
            border: '3px solid #ff6b35',
          }}
        >
          {/* SVG for board lines */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 900 1000"
            preserveAspectRatio="none"
            style={{ zIndex: 0 }}
          >
            {rows.map((r) => (
              <line
                key={`h-${r}`}
                x1={50} y1={50 + r * 100}
                x2={850} y2={50 + r * 100}
                stroke="#8b6914" strokeWidth="2"
              />
            ))}
            {cols.map((c) => (
              <line
                key={`v-${c}`}
                x1={50 + c * 100} y1={50}
                x2={50 + c * 100} y2={950}
                stroke="#8b6914" strokeWidth="2"
              />
            ))}
            <rect x={50} y={450} width={800} height={100} fill="rgba(139, 105, 20, 0.05)" />
            <text x={450} y={510} textAnchor="middle" fill="rgba(139,105,20,0.3)" fontSize="36" fontWeight="bold">
              楚 河 漢 界
            </text>
            <line x1={350} y1={50} x2={550} y2={250} stroke="#8b6914" strokeWidth="1.5" opacity="0.6" />
            <line x1={550} y1={50} x2={350} y2={250} stroke="#8b6914" strokeWidth="1.5" opacity="0.6" />
            <line x1={350} y1={750} x2={550} y2={950} stroke="#8b6914" strokeWidth="1.5" opacity="0.6" />
            <line x1={550} y1={750} x2={350} y2={950} stroke="#8b6914" strokeWidth="1.5" opacity="0.6" />
          </svg>

          {/* Clickable cells overlay */}
          {rows.map((displayR) => {
            const boardR = flipped ? 9 - displayR : displayR;
            return cols.map((displayC) => {
              const boardC = flipped ? 8 - displayC : displayC;
              const piece = gameState.board[boardR][boardC];
              const isTarget = isValidMoveTarget(boardR, boardC);
              const isLast = isLastMoveCell(boardR, boardC);

              return (
                <div
                  key={`${displayR}-${displayC}`}
                  className={`absolute flex items-center justify-center cursor-pointer ${
                    isLast ? 'last-move' : ''
                  }`}
                  style={{
                    left: `${((50 + displayC * 100 - 45) / 900) * 100}%`,
                    top: `${((50 + displayR * 100 - 45) / 1000) * 100}%`,
                    width: `${(90 / 900) * 100}%`,
                    height: `${(90 / 1000) * 100}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    borderRadius: '50%',
                  }}
                  onClick={() => handleCellClick(displayR, displayC)}
                >
                  {renderPiece(piece, boardR, boardC)}
                  {isTarget && !piece && <div className="valid-move-dot" />}
                  {isTarget && piece && <div className="valid-move-capture" />}
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}
