import {
  GameState,
  Player,
  getValidMovesForPlayer,
  makeMove,
  PIECE_VALUES,
  isInCheck,
} from './janggi';

export type AiLevel = 'baby' | 'student' | 'genius' | 'robot';

interface ScoredMove {
  from: [number, number];
  to: [number, number];
  score: number;
}

function evaluateBoard(state: GameState, aiPlayer: Player): number {
  let score = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = state.board[r][c];
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type];
      if (piece.player === aiPlayer) {
        score += value;
      } else {
        score -= value;
      }
    }
  }
  // Bonus for check
  const opponent: Player = aiPlayer === 'cho' ? 'han' : 'cho';
  if (isInCheck(state.board, opponent)) score += 2;
  if (isInCheck(state.board, aiPlayer)) score -= 2;
  if (state.winner === aiPlayer) score += 1000;
  if (state.winner && state.winner !== aiPlayer) score -= 1000;
  return score;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiPlayer: Player
): number {
  if (depth === 0 || state.winner) {
    return evaluateBoard(state, aiPlayer);
  }

  const moves = getValidMovesForPlayer(state, state.turn);
  if (moves.length === 0) {
    return evaluateBoard(state, aiPlayer);
  }

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newState = makeMove(state, move.from, move.to);
      const eval_ = minimax(newState, depth - 1, alpha, beta, false, aiPlayer);
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newState = makeMove(state, move.from, move.to);
      const eval_ = minimax(newState, depth - 1, alpha, beta, true, aiPlayer);
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export function getAiMove(
  state: GameState,
  level: AiLevel
): { from: [number, number]; to: [number, number] } | null {
  const moves = getValidMovesForPlayer(state, state.turn);
  if (moves.length === 0) return null;

  switch (level) {
    case 'baby': {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    case 'student': {
      const scored: ScoredMove[] = moves.map((m) => {
        const target = state.board[m.to[0]][m.to[1]];
        const captureValue = target ? PIECE_VALUES[target.type] : 0;
        return { ...m, score: captureValue + Math.random() * 0.5 };
      });
      scored.sort((a, b) => b.score - a.score);
      const topCount = Math.min(3, scored.length);
      return scored[Math.floor(Math.random() * topCount)];
    }

    case 'genius': {
      let bestMove = moves[0];
      let bestScore = -Infinity;
      for (const move of moves) {
        const newState = makeMove(state, move.from, move.to);
        const score = minimax(newState, 1, -Infinity, Infinity, false, state.turn);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
      return bestMove;
    }

    case 'robot': {
      let bestMove = moves[0];
      let bestScore = -Infinity;
      const shuffled = [...moves].sort(() => Math.random() - 0.5);
      for (const move of shuffled) {
        const newState = makeMove(state, move.from, move.to);
        const score = minimax(newState, 2, -Infinity, Infinity, false, state.turn);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
      return bestMove;
    }
  }
}
