export type Player = 'cho' | 'han';
export type PieceType = 'king' | 'chariot' | 'cannon' | 'horse' | 'elephant' | 'advisor' | 'soldier';

export interface Piece {
  type: PieceType;
  player: Player;
}

export type Board = (Piece | null)[][];

export interface GameState {
  board: Board;
  turn: Player;
  isCheck: boolean;
  isCheckmate: boolean;
  winner: Player | null;
  moveHistory: Move[];
}

export interface Move {
  from: [number, number];
  to: [number, number];
  captured?: Piece;
}

function p(type: PieceType, player: Player): Piece {
  return { type, player };
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 10 }, () => Array(9).fill(null));

  // Han (red) - top side (rows 0-4)
  board[0][0] = p('chariot', 'han');
  board[0][1] = p('horse', 'han');
  board[0][2] = p('elephant', 'han');
  board[0][3] = p('advisor', 'han');
  board[0][5] = p('advisor', 'han');
  board[0][6] = p('elephant', 'han');
  board[0][7] = p('horse', 'han');
  board[0][8] = p('chariot', 'han');
  board[1][4] = p('king', 'han');
  board[2][1] = p('cannon', 'han');
  board[2][7] = p('cannon', 'han');
  board[3][0] = p('soldier', 'han');
  board[3][2] = p('soldier', 'han');
  board[3][4] = p('soldier', 'han');
  board[3][6] = p('soldier', 'han');
  board[3][8] = p('soldier', 'han');

  // Cho (green/blue) - bottom side (rows 5-9)
  board[9][0] = p('chariot', 'cho');
  board[9][1] = p('horse', 'cho');
  board[9][2] = p('elephant', 'cho');
  board[9][3] = p('advisor', 'cho');
  board[9][5] = p('advisor', 'cho');
  board[9][6] = p('elephant', 'cho');
  board[9][7] = p('horse', 'cho');
  board[9][8] = p('chariot', 'cho');
  board[8][4] = p('king', 'cho');
  board[7][1] = p('cannon', 'cho');
  board[7][7] = p('cannon', 'cho');
  board[6][0] = p('soldier', 'cho');
  board[6][2] = p('soldier', 'cho');
  board[6][4] = p('soldier', 'cho');
  board[6][6] = p('soldier', 'cho');
  board[6][8] = p('soldier', 'cho');

  return board;
}

export function createInitialState(): GameState {
  return {
    board: createInitialBoard(),
    turn: 'cho',
    isCheck: false,
    isCheckmate: false,
    winner: null,
    moveHistory: [],
  };
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 10 && c >= 0 && c < 9;
}

// Palace boundaries
function isInPalace(r: number, c: number, player: Player): boolean {
  if (c < 3 || c > 5) return false;
  if (player === 'han') return r >= 0 && r <= 2;
  return r >= 7 && r <= 9;
}

function isInAnyPalace(r: number, c: number): boolean {
  if (c < 3 || c > 5) return false;
  return (r >= 0 && r <= 2) || (r >= 7 && r <= 9);
}

// Palace diagonal lines connect specific points
const palaceDiagonalDirs: [number, number][] = [
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

function canMoveDiagonalInPalace(fromR: number, fromC: number, toR: number, toC: number): boolean {
  if (!isInAnyPalace(fromR, fromC) || !isInAnyPalace(toR, toC)) return false;
  // Diagonal moves in palace: center connects to corners, corners connect to center
  // Han palace center: (1,4), corners: (0,3),(0,5),(2,3),(2,5)
  // Cho palace center: (8,4), corners: (7,3),(7,5),(9,3),(9,5)
  const dr = Math.abs(toR - fromR);
  const dc = Math.abs(toC - fromC);
  if (dr !== 1 || dc !== 1) return false;

  // Must be on a diagonal line of the palace
  // The diagonals connect: center(x,4) to corners, and mid-edges don't have diagonals
  // Specifically: (0,3)-(1,4)-(2,5) and (0,5)-(1,4)-(2,3) for han
  // (7,3)-(8,4)-(9,5) and (7,5)-(8,4)-(9,3) for cho
  const centerR = (fromR <= 2 && toR <= 2) ? 1 : (fromR >= 7 && toR >= 7) ? 8 : -1;
  if (centerR === -1) return false;

  // One of from/to must be the center, or both must be on same diagonal through center
  if ((fromR === centerR && fromC === 4) || (toR === centerR && toC === 4)) {
    return true;
  }
  // Corner to corner through center (2 steps - not applicable for 1-step moves)
  return false;
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

export function getPieceChar(piece: Piece): string {
  switch (piece.type) {
    case 'king': return '궁';
    case 'chariot': return '車';
    case 'cannon': return '包';
    case 'horse': return '馬';
    case 'elephant': return '象';
    case 'advisor': return '士';
    case 'soldier': return piece.player === 'cho' ? '卒' : '兵';
  }
}

function getRawMoves(board: Board, row: number, col: number): [number, number][] {
  const piece = board[row][col];
  if (!piece) return [];

  const moves: [number, number][] = [];
  const { type, player } = piece;

  switch (type) {
    case 'king': {
      // Moves 1 step in any direction within palace (orthogonal + palace diagonals)
      const orthDirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of orthDirs) {
        const nr = row + dr, nc = col + dc;
        if (inBounds(nr, nc) && isInPalace(nr, nc, player)) {
          const target = board[nr][nc];
          if (!target || target.player !== player) {
            moves.push([nr, nc]);
          }
        }
      }
      // Diagonal moves within palace
      for (const [dr, dc] of palaceDiagonalDirs) {
        const nr = row + dr, nc = col + dc;
        if (inBounds(nr, nc) && isInPalace(nr, nc, player) && canMoveDiagonalInPalace(row, col, nr, nc)) {
          const target = board[nr][nc];
          if (!target || target.player !== player) {
            moves.push([nr, nc]);
          }
        }
      }
      break;
    }

    case 'advisor': {
      // Same as king - moves within palace
      const orthDirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of orthDirs) {
        const nr = row + dr, nc = col + dc;
        if (inBounds(nr, nc) && isInPalace(nr, nc, player)) {
          const target = board[nr][nc];
          if (!target || target.player !== player) {
            moves.push([nr, nc]);
          }
        }
      }
      for (const [dr, dc] of palaceDiagonalDirs) {
        const nr = row + dr, nc = col + dc;
        if (inBounds(nr, nc) && isInPalace(nr, nc, player) && canMoveDiagonalInPalace(row, col, nr, nc)) {
          const target = board[nr][nc];
          if (!target || target.player !== player) {
            moves.push([nr, nc]);
          }
        }
      }
      break;
    }

    case 'chariot': {
      // Straight lines any distance
      const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        let nr = row + dr, nc = col + dc;
        while (inBounds(nr, nc)) {
          const target = board[nr][nc];
          if (target) {
            if (target.player !== player) moves.push([nr, nc]);
            break;
          }
          moves.push([nr, nc]);
          nr += dr;
          nc += dc;
        }
      }
      // Chariot can also move along palace diagonals
      if (isInAnyPalace(row, col)) {
        for (const [dr, dc] of palaceDiagonalDirs) {
          // Can only start diagonal from center or corners of palace
          if (!canMoveDiagonalInPalace(row, col, row + dr, col + dc)) continue;
          let nr = row + dr, nc = col + dc;
          while (inBounds(nr, nc) && isInAnyPalace(nr, nc)) {
            const target = board[nr][nc];
            if (target) {
              if (target.player !== player) moves.push([nr, nc]);
              break;
            }
            moves.push([nr, nc]);
            if (!canMoveDiagonalInPalace(nr, nc, nr + dr, nc + dc)) break;
            nr += dr;
            nc += dc;
          }
        }
      }
      break;
    }

    case 'cannon': {
      // Moves like chariot but must jump over exactly one piece (not another cannon)
      const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        let nr = row + dr, nc = col + dc;
        let jumped = false;
        let jumpedPiece: Piece | null = null;
        while (inBounds(nr, nc)) {
          const target = board[nr][nc];
          if (!jumped) {
            if (target) {
              if (target.type === 'cannon') break; // Cannot jump over cannon
              jumped = true;
              jumpedPiece = target;
            }
          } else {
            if (target) {
              if (target.type === 'cannon') break; // Cannot capture cannon
              if (target.player !== player) moves.push([nr, nc]);
              break;
            }
            moves.push([nr, nc]);
          }
          nr += dr;
          nc += dc;
        }
      }
      // Cannon palace diagonal movement
      if (isInAnyPalace(row, col)) {
        for (const [dr, dc] of palaceDiagonalDirs) {
          if (!canMoveDiagonalInPalace(row, col, row + dr, col + dc)) continue;
          let nr = row + dr, nc = col + dc;
          let jumped = false;
          while (inBounds(nr, nc) && isInAnyPalace(nr, nc)) {
            const target = board[nr][nc];
            if (!jumped) {
              if (target) {
                if (target.type === 'cannon') break;
                jumped = true;
              }
            } else {
              if (target) {
                if (target.type === 'cannon') break;
                if (target.player !== player) moves.push([nr, nc]);
                break;
              }
              moves.push([nr, nc]);
            }
            if (!canMoveDiagonalInPalace(nr, nc, nr + dr, nc + dc)) break;
            nr += dr;
            nc += dc;
          }
        }
      }
      break;
    }

    case 'horse': {
      // 1 step orthogonal, then 1 step diagonal (can be blocked)
      const horseMoves: [number, number, number, number][] = [
        [-1, 0, -2, -1], [-1, 0, -2, 1],  // up then diagonal
        [1, 0, 2, -1], [1, 0, 2, 1],      // down then diagonal
        [0, -1, -1, -2], [0, -1, 1, -2],  // left then diagonal
        [0, 1, -1, 2], [0, 1, 1, 2],      // right then diagonal
      ];
      for (const [mr, mc, fr, fc] of horseMoves) {
        const midR = row + mr, midC = col + mc;
        const endR = row + fr, endC = col + fc;
        if (!inBounds(midR, midC) || !inBounds(endR, endC)) continue;
        if (board[midR][midC]) continue; // blocked
        const target = board[endR][endC];
        if (!target || target.player !== player) {
          moves.push([endR, endC]);
        }
      }
      break;
    }

    case 'elephant': {
      // 1 step orthogonal, then 2 steps diagonal (can be blocked at each step)
      const elephantMoves: [number, number, number, number, number, number][] = [
        [-1, 0, -2, -1, -3, -2], [-1, 0, -2, 1, -3, 2],
        [1, 0, 2, -1, 3, -2], [1, 0, 2, 1, 3, 2],
        [0, -1, -1, -2, -2, -3], [0, -1, 1, -2, 2, -3],
        [0, 1, -1, 2, -2, 3], [0, 1, 1, 2, 2, 3],
      ];
      for (const [m1r, m1c, m2r, m2c, fr, fc] of elephantMoves) {
        const mid1R = row + m1r, mid1C = col + m1c;
        const mid2R = row + m2r, mid2C = col + m2c;
        const endR = row + fr, endC = col + fc;
        if (!inBounds(mid1R, mid1C) || !inBounds(mid2R, mid2C) || !inBounds(endR, endC)) continue;
        if (board[mid1R][mid1C]) continue; // blocked at first step
        if (board[mid2R][mid2C]) continue; // blocked at second step
        const target = board[endR][endC];
        if (!target || target.player !== player) {
          moves.push([endR, endC]);
        }
      }
      break;
    }

    case 'soldier': {
      // Forward and sideways, never backward
      const forward = player === 'cho' ? -1 : 1;
      const soldierDirs: [number, number][] = [
        [forward, 0], [0, -1], [0, 1],
      ];
      for (const [dr, dc] of soldierDirs) {
        const nr = row + dr, nc = col + dc;
        if (!inBounds(nr, nc)) continue;
        const target = board[nr][nc];
        if (!target || target.player !== player) {
          moves.push([nr, nc]);
        }
      }
      // Soldier can also move diagonally forward in palace
      if (isInAnyPalace(row, col)) {
        const diagDirs: [number, number][] = [
          [forward, -1], [forward, 1],
        ];
        for (const [dr, dc] of diagDirs) {
          const nr = row + dr, nc = col + dc;
          if (inBounds(nr, nc) && isInAnyPalace(nr, nc) && canMoveDiagonalInPalace(row, col, nr, nc)) {
            const target = board[nr][nc];
            if (!target || target.player !== player) {
              moves.push([nr, nc]);
            }
          }
        }
      }
      break;
    }
  }

  return moves;
}

function findKing(board: Board, player: Player): [number, number] | null {
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'king' && piece.player === player) {
        return [r, c];
      }
    }
  }
  return null;
}

export function isInCheck(board: Board, player: Player): boolean {
  const kingPos = findKing(board, player);
  if (!kingPos) return false;
  const [kr, kc] = kingPos;
  const opponent: Player = player === 'cho' ? 'han' : 'cho';

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.player === opponent) {
        const rawMoves = getRawMoves(board, r, c);
        if (rawMoves.some(([mr, mc]) => mr === kr && mc === kc)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function getValidMoves(state: GameState, row: number, col: number): [number, number][] {
  const piece = state.board[row][col];
  if (!piece || piece.player !== state.turn) return [];

  const rawMoves = getRawMoves(state.board, row, col);

  // Filter out moves that would leave own king in check
  return rawMoves.filter(([tr, tc]) => {
    const newBoard = cloneBoard(state.board);
    newBoard[tr][tc] = newBoard[row][col];
    newBoard[row][col] = null;
    return !isInCheck(newBoard, state.turn);
  });
}

export function getValidMovesForPlayer(state: GameState, player: Player): { from: [number, number]; to: [number, number] }[] {
  const allMoves: { from: [number, number]; to: [number, number] }[] = [];
  const tempState = { ...state, turn: player };
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = state.board[r][c];
      if (piece && piece.player === player) {
        const moves = getValidMoves(tempState, r, c);
        for (const [tr, tc] of moves) {
          allMoves.push({ from: [r, c], to: [tr, tc] });
        }
      }
    }
  }
  return allMoves;
}

export function isCheckmate(state: GameState): boolean {
  if (!isInCheck(state.board, state.turn)) return false;
  const moves = getValidMovesForPlayer(state, state.turn);
  return moves.length === 0;
}

export function makeMove(state: GameState, from: [number, number], to: [number, number]): GameState {
  const [fr, fc] = from;
  const [tr, tc] = to;
  const newBoard = cloneBoard(state.board);
  const captured = newBoard[tr][tc] || undefined;
  newBoard[tr][tc] = newBoard[fr][fc];
  newBoard[fr][fc] = null;

  const nextTurn: Player = state.turn === 'cho' ? 'han' : 'cho';

  const newState: GameState = {
    board: newBoard,
    turn: nextTurn,
    isCheck: false,
    isCheckmate: false,
    winner: state.winner,
    moveHistory: [...state.moveHistory, { from, to, captured }],
  };

  // Check if opponent king was captured (instant win)
  if (captured && captured.type === 'king') {
    newState.winner = state.turn;
    newState.isCheckmate = true;
    return newState;
  }

  newState.isCheck = isInCheck(newBoard, nextTurn);

  if (newState.isCheck) {
    const opponentMoves = getValidMovesForPlayer(newState, nextTurn);
    if (opponentMoves.length === 0) {
      newState.isCheckmate = true;
      newState.winner = state.turn;
    }
  } else {
    // Check stalemate (no legal moves = loss in janggi)
    const opponentMoves = getValidMovesForPlayer(newState, nextTurn);
    if (opponentMoves.length === 0) {
      newState.winner = state.turn;
      newState.isCheckmate = true;
    }
  }

  return newState;
}

export const PIECE_VALUES: Record<PieceType, number> = {
  king: 0,
  chariot: 13,
  cannon: 7,
  horse: 5,
  elephant: 3,
  advisor: 3,
  soldier: 2,
};
