import { RANKS, SUITS, decodeCard, encodeCard } from "./card.js";
import { nextBoundedInt } from "./random-source.js";

export class DeckValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeckValidationError";
    this.code = code;
  }
}

export class DeckExhaustedError extends Error {
  constructor(required, available) {
    super(`Deck has ${available} cards remaining but ${required} are required.`);
    this.name = "DeckExhaustedError";
    this.code = "POKER_DECK_EXHAUSTED";
    this.required = required;
    this.available = available;
  }
}

class DeckState {
  #cards;

  constructor(cards) {
    this.#cards = Object.freeze(cards.slice());
    Object.freeze(this);
  }

  get size() {
    return this.#cards.length;
  }

  get cards() {
    return this.#cards;
  }

  get codes() {
    return Object.freeze(this.#cards.map((card) => card.code));
  }

  has(code) {
    const canonical = decodeCard(code).code;
    return this.#cards.some((card) => card.code === canonical);
  }

  shuffle(randomSource) {
    const shuffled = this.#cards.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = nextBoundedInt(randomSource, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return new DeckState(shuffled);
  }

  drawOne() {
    assertAvailable(this.#cards, 1);
    return Object.freeze({
      card: this.#cards[0],
      deck: new DeckState(this.#cards.slice(1)),
    });
  }

  dealRoundRobin(recipients, cardsPerRecipient = 2) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new DeckValidationError("POKER_INVALID_DEAL_RECIPIENTS", "At least one deal recipient is required.");
    }
    if (!Number.isSafeInteger(cardsPerRecipient) || cardsPerRecipient <= 0) {
      throw new DeckValidationError("POKER_INVALID_DEAL_COUNT", "cardsPerRecipient must be a positive safe integer.");
    }

    const required = recipients.length * cardsPerRecipient;
    assertAvailable(this.#cards, required);

    const hands = recipients.map((recipient) => ({ recipient, cards: [] }));
    let offset = 0;
    for (let pass = 0; pass < cardsPerRecipient; pass += 1) {
      for (let recipientIndex = 0; recipientIndex < hands.length; recipientIndex += 1) {
        hands[recipientIndex].cards.push(this.#cards[offset]);
        offset += 1;
      }
    }

    const frozenHands = Object.freeze(hands.map((hand) => Object.freeze({
      recipient: hand.recipient,
      cards: Object.freeze(hand.cards.slice()),
    })));

    return Object.freeze({
      hands: frozenHands,
      deck: new DeckState(this.#cards.slice(required)),
    });
  }

  burnOne() {
    const { card, deck } = this.drawOne();
    return Object.freeze({ burned: card, deck });
  }

  dealFlop() {
    return dealBoardStreet(this, 3);
  }

  dealTurn() {
    return dealBoardStreet(this, 1);
  }

  dealRiver() {
    return dealBoardStreet(this, 1);
  }
}

export function createFullDeck() {
  const cards = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      cards.push(decodeCard(`${rank}${suit}`));
    }
  }
  return createValidatedFullDeck(cards);
}

export function createFullDeckFromCodes(codes) {
  if (!Array.isArray(codes)) {
    throw new DeckValidationError("POKER_INVALID_FULL_DECK", "Full deck codes must be an array.");
  }
  if (codes.length !== 52) {
    throw new DeckValidationError("POKER_FULL_DECK_SIZE", `A full deck must contain exactly 52 cards; received ${codes.length}.`);
  }

  const cards = codes.map((code) => decodeCard(code));
  return createValidatedFullDeck(cards);
}

function createValidatedFullDeck(cards) {
  if (cards.length !== 52) {
    throw new DeckValidationError("POKER_FULL_DECK_SIZE", `A full deck must contain exactly 52 cards; received ${cards.length}.`);
  }

  const codes = cards.map((card) => encodeCard(card));
  if (new Set(codes).size !== 52) {
    throw new DeckValidationError("POKER_DUPLICATE_CARD", "A full deck must contain 52 unique cards.");
  }

  const expected = new Set(RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`)));
  if (codes.some((code) => !expected.has(code)) || codes.some((code) => codes.filter((candidate) => candidate === code).length !== 1)) {
    throw new DeckValidationError("POKER_INVALID_FULL_DECK", "A full deck must contain each canonical poker card exactly once.");
  }

  return new DeckState(cards);
}

function dealBoardStreet(deck, boardCardCount) {
  const required = 1 + boardCardCount;
  assertAvailable(deck.cards, required);

  const burned = deck.cards[0];
  const cards = Object.freeze(deck.cards.slice(1, required));
  const remaining = new DeckState(deck.cards.slice(required));

  return Object.freeze({ burned, cards, deck: remaining });
}

function assertAvailable(cards, required) {
  if (cards.length < required) {
    throw new DeckExhaustedError(required, cards.length);
  }
}
