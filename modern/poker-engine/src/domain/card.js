export const RANKS = Object.freeze(["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]);
export const SUITS = Object.freeze(["c", "d", "h", "s"]);

const RANK_SET = new Set(RANKS);
const SUIT_SET = new Set(SUITS);

export class CardValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CardValidationError";
    this.code = code;
  }
}

export function assertRank(rank) {
  if (typeof rank !== "string" || !RANK_SET.has(rank)) {
    throw new CardValidationError("POKER_INVALID_RANK", `Invalid poker rank: ${String(rank)}`);
  }
  return rank;
}

export function assertSuit(suit) {
  if (typeof suit !== "string" || !SUIT_SET.has(suit)) {
    throw new CardValidationError("POKER_INVALID_SUIT", `Invalid poker suit: ${String(suit)}`);
  }
  return suit;
}

export function createCard(rank, suit) {
  assertRank(rank);
  assertSuit(suit);
  return Object.freeze({ rank, suit, code: `${rank}${suit}` });
}

export function encodeCard(card) {
  if (card === null || typeof card !== "object") {
    throw new CardValidationError("POKER_INVALID_CARD", "Card must be an object with rank and suit.");
  }
  return createCard(card.rank, card.suit).code;
}

export function decodeCard(code) {
  if (typeof code !== "string" || code.length !== 2) {
    throw new CardValidationError("POKER_INVALID_CARD_CODE", `Invalid poker card code: ${String(code)}`);
  }

  const [rank, suit] = code;
  if (!RANK_SET.has(rank) || !SUIT_SET.has(suit)) {
    throw new CardValidationError("POKER_INVALID_CARD_CODE", `Invalid poker card code: ${code}`);
  }

  return createCard(rank, suit);
}
