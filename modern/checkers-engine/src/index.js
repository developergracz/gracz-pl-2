export const BOARD_SIZE = 8;

export const PLAYERS = Object.freeze({
  WHITE: "white",
  BLACK: "black",
});

export const PIECES = Object.freeze({
  WHITE_MAN: "white-man",
  WHITE_KING: "white-king",
  BLACK_MAN: "black-man",
  BLACK_KING: "black-king",
});

const ALL_DIRECTIONS = Object.freeze([
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]);

export class IllegalMoveError extends Error {
  constructor(message, code = "ILLEGAL_MOVE") {
    super(message);
    this.name = "IllegalMoveError";
    this.code = code;
  }
}

export function createInitialState() {
  const board = createEmptyBoard();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      if (!isPlayableSquare(row, column)) continue;
      if (row < 3) board[row][column] = PIECES.WHITE_MAN;
      if (row >= BOARD_SIZE - 3) board[row][column] = PIECES.BLACK_MAN;
    }
  }

  return freezeState({
    board,
    turn: PLAYERS.WHITE,
    forcedPiece: null,
    winner: null,
    moveNumber: 1,
  });
}

export function createState({
  board = createEmptyBoard(),
  turn = PLAYERS.WHITE,
  forcedPiece = null,
  winner = null,
  moveNumber = 1,
} = {}) {
  validateBoard(board);
  assertPlayer(turn);
  return freezeState({ board: cloneBoard(board), turn, forcedPiece, winner, moveNumber });
}

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function getLegalMoves(state) {
  validateState(state);
  if (state.winner) return [];

  const starts = state.forcedPiece
    ? [state.forcedPiece]
    : coordinatesForPlayer(state.board, state.turn);

  const captures = starts.flatMap((from) => captureMoves(state.board, from));
  if (captures.length > 0) return captures;
  if (state.forcedPiece) return [];
  return starts.flatMap((from) => quietMoves(state.board, from));
}

export function applyMove(state, requestedMove) {
  validateState(state);
  const move = normalizeMove(requestedMove);
  const legalMove = getLegalMoves(state).find((candidate) => sameMove(candidate, move));

  if (!legalMove) {
    throw new IllegalMoveError("Ruch jest niedozwolony w aktualnym stanie gry.");
  }

  const board = cloneBoard(state.board);
  let piece = board[legalMove.from.row][legalMove.from.column];
  board[legalMove.from.row][legalMove.from.column] = null;

  if (legalMove.capture) {
    board[legalMove.capture.row][legalMove.capture.column] = null;
  }

  piece = promoteIfNeeded(piece, legalMove.to.row);
  board[legalMove.to.row][legalMove.to.column] = piece;

  if (legalMove.capture) {
    const continuation = captureMoves(board, legalMove.to);
    if (continuation.length > 0) {
      return freezeState({
        board,
        turn: state.turn,
        forcedPiece: { ...legalMove.to },
        winner: null,
        moveNumber: state.moveNumber,
      });
    }
  }

  const nextPlayer = opponentOf(state.turn);
  const nextState = {
    board,
    turn: nextPlayer,
    forcedPiece: null,
    winner: null,
    moveNumber: state.moveNumber + 1,
  };
  nextState.winner = determineWinner(nextState);
  return freezeState(nextState);
}

export function determineWinner(state) {
  validateBoard(state.board);
  assertPlayer(state.turn);

  const currentPieces = coordinatesForPlayer(state.board, state.turn);
  if (currentPieces.length === 0) return opponentOf(state.turn);

  const probe = { ...state, winner: null };
  if (getLegalMoves(probe).length === 0) return opponentOf(state.turn);
  return null;
}

export function opponentOf(player) {
  assertPlayer(player);
  return player === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;
}

function quietMoves(board, from) {
  const piece = board[from.row][from.column];
  return movementDirections(piece).flatMap(([rowDelta, columnDelta]) => {
    const to = { row: from.row + rowDelta, column: from.column + columnDelta };
    return insideBoard(to) && board[to.row][to.column] === null
      ? [{ from: { ...from }, to }]
      : [];
  });
}

function captureMoves(board, from) {
  const piece = board[from.row][from.column];
  const owner = playerForPiece(piece);
  if (!owner) return [];

  return movementDirections(piece).flatMap(([rowDelta, columnDelta]) => {
    const capture = { row: from.row + rowDelta, column: from.column + columnDelta };
    const to = { row: from.row + rowDelta * 2, column: from.column + columnDelta * 2 };
    const capturedPiece = insideBoard(capture) ? board[capture.row][capture.column] : null;

    return insideBoard(to) && board[to.row][to.column] === null
      && capturedPiece && playerForPiece(capturedPiece) === opponentOf(owner)
      ? [{ from: { ...from }, to, capture }]
      : [];
  });
}

function movementDirections(piece) {
  if (piece === PIECES.WHITE_MAN) return [[1, -1], [1, 1]];
  if (piece === PIECES.BLACK_MAN) return [[-1, -1], [-1, 1]];
  if (piece === PIECES.WHITE_KING || piece === PIECES.BLACK_KING) return ALL_DIRECTIONS;
  return [];
}

function promoteIfNeeded(piece, row) {
  if (piece === PIECES.WHITE_MAN && row === BOARD_SIZE - 1) return PIECES.WHITE_KING;
  if (piece === PIECES.BLACK_MAN && row === 0) return PIECES.BLACK_KING;
  return piece;
}

function coordinatesForPlayer(board, player) {
  const result = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      if (playerForPiece(board[row][column]) === player) result.push({ row, column });
    }
  }
  return result;
}

function playerForPiece(piece) {
  if (piece === PIECES.WHITE_MAN || piece === PIECES.WHITE_KING) return PLAYERS.WHITE;
  if (piece === PIECES.BLACK_MAN || piece === PIECES.BLACK_KING) return PLAYERS.BLACK;
  return null;
}

function normalizeMove(move) {
  if (!move?.from || !move?.to) throw new IllegalMoveError("Ruch wymaga pól from i to.", "INVALID_MOVE");
  return {
    from: normalizePosition(move.from),
    to: normalizePosition(move.to),
  };
}

function normalizePosition(position) {
  const normalized = { row: Number(position.row), column: Number(position.column) };
  if (!Number.isInteger(normalized.row) || !Number.isInteger(normalized.column) || !insideBoard(normalized)) {
    throw new IllegalMoveError("Współrzędne ruchu muszą wskazywać pole planszy.", "INVALID_POSITION");
  }
  return normalized;
}

function sameMove(left, right) {
  return left.from.row === right.from.row && left.from.column === right.from.column
    && left.to.row === right.to.row && left.to.column === right.to.column;
}

function isPlayableSquare(row, column) {
  return (row + column) % 2 === 1;
}

function insideBoard({ row, column }) {
  return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE;
}

function validateState(state) {
  if (!state || typeof state !== "object") throw new TypeError("Stan gry jest wymagany.");
  validateBoard(state.board);
  assertPlayer(state.turn);
  if (state.forcedPiece) normalizePosition(state.forcedPiece);
}

function validateBoard(board) {
  if (!Array.isArray(board) || board.length !== BOARD_SIZE
    || board.some((row) => !Array.isArray(row) || row.length !== BOARD_SIZE)) {
    throw new TypeError("Plansza musi mieć rozmiar 8×8.");
  }
}

function assertPlayer(player) {
  if (player !== PLAYERS.WHITE && player !== PLAYERS.BLACK) {
    throw new TypeError(`Nieznany gracz: ${player}`);
  }
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function freezeState(state) {
  state.board.forEach(Object.freeze);
  Object.freeze(state.board);
  if (state.forcedPiece) Object.freeze(state.forcedPiece);
  return Object.freeze(state);
}
