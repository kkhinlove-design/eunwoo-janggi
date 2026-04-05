'use client';

import { useState, useEffect, useCallback } from 'react';
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
  /** External game state for online multiplayer (overrides internal state) */
  externalGameState?: GameState | null;
  /** Callback when a move is made in online mode - parent handles Supabase update */
  onBoardChange?: (newState: GameState) => void;
  /** If true, only allow moves for playerSide (online multiplayer) */
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

  // Use external state for online multiplayer, internal for AI/local
  const gameState = (isOnlineMultiplayer && externalGameState) ? externalGameState : internalGameState;
  const setGameState = isOnlineMultiplayer
    ? (newState: GameState | ((prev: GameState) => GameState)) => {
        // For online, we notify parent instead of setting internal state
        const resolved = typeof newState === 'function' ? newState(gameState) : newState;
        onBoardChange?.(resolved);
      }
    : setInternalGameState;

  // Sync external state changes (clear selection when opponent moves)
  useEffect(() => {
    if (isOnlineMultiplayer && externalGameState) {
      setSelected(null);
      setValidMoves([]);
    }
  }, [isOnlineMultiplayer, externalGameState]);

  // Flip board if player is han
  const flipped = playerSide === 'han' && !isLocalMultiplayer;

  const isPlayerTurn = isLocalMultiplayer || gameState.turn === playerSide;

  // AI move
  useEffect(() => {
    if (isOnlineMultiplayer || gameState.winner || isPlayerTurn || !aiLevel || isAiThinking) return;

    setIsAiThinking(true);
    const timer = setTimeout(() => {
      const move = getAiMove(gameState, aiLevel);
      if (move) {
        const newState = makeMove(gameState, move.from, move.to);
        setGameState(newState);
        setLastMove({ from: move.from, to: move.to });
        onMove?.(newState.moveHistory.length);
        if (newState.winner) {
          onGameEnd?.(newState.winner);
        }
      }
      setIsAiThinking(false);
    }, 400 + Math.random() * 600);

    return () => clearTimeout(timer);
  }, [gameState, isPlayerTurn, aiLevel, isAiThinking, isOnlineMultiplayer, onGameEnd, onMove]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (gameState.winner || !isPlayerTurn || isAiThinking) return;

      // Map display coords to board coords
      const boardRow = flipped ? 9 - row : row;
      const boardCol = flipped ? 8 - col : col;

      const piece = gameState.board[boardRow][boardCol];

      // If clicking on a valid move target
      if (selected) {
        const isValidTarget = validMoves.some(([r, c]) => r === boardRow && c === boardCol);
        if (isValidTarget) {
          const newState = makeMove(gameState, selected, [boardRow, boardCol]);
          setGameState(newState);
          setLastMove({ from: selected, to: [boardRow, boardCol] });
          setSelected(null);
          setValidMoves([]);
          onMove?.(newState.moveHistory.length);
          if (newState.winner) {
            onGameEnd?.(newState.winner);
          }
          return;
        }
      }

      // Select a piece
      if (piece && piece.player === gameState.turn) {
        setSelected([boardRow, boardCol]);
        const moves = getValidMoves(gameState, boardRow, boardCol);
        setValidMoves(moves);
      } else {
        setSelected(null);
        setValidMoves([]);
      }
    },
    [gameState, selected, validMoves, flipped, isPlayerTurn, isAiThinking, onGameEnd, onMove]
  );

  const resetGame = () => {
    setGameState(createInitialState());
    setSelected(null);
    setValidMoves([]);
    setLastMove(null);
    setIsAiThinking(false);
  };

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

  // Build the board grid with lines
  const rows = Array.from({ length: 10 }, (_, i) => i);
  const cols = Array.from({ length: 9 }, (_, i) => i);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Turn indicator */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-white">
        <div
          className={`px-3 py-1 rounded-full text-sm font-bold ${
            gameState.turn === 'han'
              ? 'bg-red-600'
              : 'bg-white/20'
          }`}
        >
          한 (Red) {gameState.turn === 'han' && (isAiThinking ? '생각 중...' : '차례')}
        </div>
        <div
          className={`px-3 py-1 rounded-full text-sm font-bold ${
            gameState.turn === 'cho'
              ? 'bg-green-600'
              : 'bg-white/20'
          }`}
        >
          초 (Green) {gameState.turn === 'cho' && (isAiThinking ? '생각 중...' : '차례')}
        </div>
      </div>

      {gameState.isCheck && !gameState.winner && (
        <div className="text-yellow-300 font-bold text-lg animate-bounce">
          장군! (Check!)
        </div>
      )}

      {/* Board */}
      <div className="relative" style={{ width: 'min(95vw, 560px)' }}>
        <div
          className="relative w-full"
          style={{
            paddingBottom: `${(10 / 9) * 100}%`,
            background: 'linear-gradient(180deg, #e8c97a 0%, #d4a84b 100%)',
            borderRadius: '8px',
            border: '3px solid #8b6914',
          }}
        >
          {/* SVG for board lines */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 900 1000"
            preserveAspectRatio="none"
            style={{ zIndex: 0 }}
          >
            {/* Horizontal lines */}
            {rows.map((r) => (
              <line
                key={`h-${r}`}
                x1={50}
                y1={50 + r * 100}
                x2={850}
                y2={50 + r * 100}
                stroke="#8b6914"
                strokeWidth="2"
              />
            ))}
            {/* Vertical lines */}
            {cols.map((c) => (
              <line
                key={`v-${c}`}
                x1={50 + c * 100}
                y1={50}
                x2={50 + c * 100}
                y2={950}
                stroke="#8b6914"
                strokeWidth="2"
              />
            ))}
            {/* River (gap between row 4 and 5) - optional decorative */}
            <rect x={50} y={450} width={800} height={100} fill="rgba(139, 105, 20, 0.05)" />
            <text x={450} y={510} textAnchor="middle" fill="rgba(139,105,20,0.3)" fontSize="36" fontWeight="bold">
              楚 河 漢 界
            </text>

            {/* Palace diagonals - Top (Han) */}
            <line x1={350} y1={50} x2={550} y2={250} stroke="#8b6914" strokeWidth="1.5" opacity="0.6" />
            <line x1={550} y1={50} x2={350} y2={250} stroke="#8b6914" strokeWidth="1.5" opacity="0.6" />
            {/* Palace diagonals - Bottom (Cho) */}
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
                  className={`absolute flex items-center justify-content cursor-pointer ${
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

      {/* Game over */}
      {gameState.winner && (
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-2">
            {gameState.winner === 'cho' ? '초 (Green)' : '한 (Red)'} 승리!
          </div>
          {gameState.isCheckmate && (
            <div className="text-yellow-300 text-sm">외통수! (Checkmate!)</div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        <button onClick={resetGame} className="btn-secondary text-sm">
          다시 시작
        </button>
      </div>
    </div>
  );
}
