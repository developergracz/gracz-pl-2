import assert from "node:assert/strict";
import test from "node:test";

import {
  DeckExhaustedError,
  DeckValidationError,
  RANKS,
  SUITS,
  createFullDeck,
  createFullDeckFromCodes,
} from "../src/index.js";

const canonicalCodes = () => RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`));

test("canonical full deck has exactly 52 cards", () => {
  assert.equal(createFullDeck().size, 52);
});

test("canonical full deck contains 52 unique cards", () => {
  const codes = createFullDeck().codes;
  assert.equal(new Set(codes).size, 52);
});

test("canonical full deck has exactly 13 ranks × 4 suits", () => {
  const deck = createFullDeck();
  for (const rank of RANKS) assert.equal(deck.cards.filter((card) => card.rank === rank).length, 4);
  for (const suit of SUITS) assert.equal(deck.cards.filter((card) => card.suit === suit).length, 13);
});

test("full deck with duplicate is rejected", () => {
  const codes = canonicalCodes();
  codes[51] = codes[0];
  assert.throws(() => createFullDeckFromCodes(codes), (error) => error instanceof DeckValidationError && error.code === "POKER_DUPLICATE_CARD");
});

test("full deck with 51 cards is rejected", () => {
  assert.throws(() => createFullDeckFromCodes(canonicalCodes().slice(0, 51)), (error) => error instanceof DeckValidationError && error.code === "POKER_FULL_DECK_SIZE");
});

test("full deck with 53 cards is rejected", () => {
  assert.throws(() => createFullDeckFromCodes([...canonicalCodes(), "As"]), (error) => error instanceof DeckValidationError && error.code === "POKER_FULL_DECK_SIZE");
});

test("draw consumes exactly one card", () => {
  const source = createFullDeck();
  const result = source.drawOne();
  assert.equal(result.card.code, source.codes[0]);
  assert.equal(result.deck.size, 51);
});

test("source Deck is unchanged after draw", () => {
  const source = createFullDeck();
  const before = source.codes;
  source.drawOne();
  assert.equal(source.size, 52);
  assert.deepEqual(source.codes, before);
});

test("deal is round-robin", () => {
  const source = createFullDeck();
  const original = source.codes;
  const result = source.dealRoundRobin(["seat-1", "seat-2", "seat-3"], 2);
  assert.deepEqual(result.hands.map((hand) => hand.cards.map((card) => card.code)), [
    [original[0], original[3]],
    [original[1], original[4]],
    [original[2], original[5]],
  ]);
});

test("deal removes the correct number of cards", () => {
  const source = createFullDeck();
  const result = source.dealRoundRobin(["seat-1", "seat-2", "seat-3"], 2);
  assert.equal(result.deck.size, 46);
});

test("source Deck is unchanged after deal", () => {
  const source = createFullDeck();
  const before = source.codes;
  source.dealRoundRobin(["seat-1", "seat-2", "seat-3"], 2);
  assert.equal(source.size, 52);
  assert.deepEqual(source.codes, before);
});

test("burn consumes exactly one card", () => {
  const source = createFullDeck();
  const result = source.burnOne();
  assert.equal(result.deck.size, 51);
  assert.equal(source.size, 52);
});

test("burned card no longer exists in the remaining deck", () => {
  const result = createFullDeck().burnOne();
  assert.equal(result.deck.has(result.burned.code), false);
});

test("flop consumes exactly four cards including one burn", () => {
  const source = createFullDeck();
  const result = source.dealFlop();
  assert.equal(result.deck.size, 48);
  assert.equal(result.deck.has(result.burned.code), false);
});

test("flop exposes exactly three board cards distinct from the burn", () => {
  const source = createFullDeck();
  const original = source.codes;
  const result = source.dealFlop();
  assert.equal(result.burned.code, original[0]);
  assert.deepEqual(result.cards.map((card) => card.code), original.slice(1, 4));
  assert.equal(result.cards.length, 3);
  assert.equal(result.cards.some((card) => card.code === result.burned.code), false);
  for (const card of result.cards) assert.equal(result.deck.has(card.code), false);
});

test("turn burns one, exposes one board card and consumes two total cards", () => {
  const source = createFullDeck();
  const result = source.dealTurn();
  assert.equal(result.cards.length, 1);
  assert.equal(result.deck.size, 50);
  assert.equal(result.deck.has(result.burned.code), false);
  assert.equal(result.deck.has(result.cards[0].code), false);
});

test("river burns one, exposes one board card and consumes two total cards", () => {
  const source = createFullDeck();
  const result = source.dealRiver();
  assert.equal(result.cards.length, 1);
  assert.equal(result.deck.size, 50);
  assert.equal(result.deck.has(result.burned.code), false);
  assert.equal(result.deck.has(result.cards[0].code), false);
});

test("exhaustion fails safely", () => {
  let deck = createFullDeck();
  for (let i = 0; i < 52; i += 1) deck = deck.drawOne().deck;
  assert.equal(deck.size, 0);
  assert.throws(() => deck.drawOne(), (error) => error instanceof DeckExhaustedError && error.code === "POKER_DECK_EXHAUSTED");
});

test("deal with insufficient cards fails safely without changing source", () => {
  let deck = createFullDeck();
  for (let i = 0; i < 50; i += 1) deck = deck.drawOne().deck;
  const before = deck.codes;
  assert.throws(() => deck.dealRoundRobin(["a", "b"], 2), DeckExhaustedError);
  assert.equal(deck.size, 2);
  assert.deepEqual(deck.codes, before);
});

test("canonical deck generation is deterministic before shuffle", () => {
  const expected = canonicalCodes();
  assert.deepEqual(createFullDeck().codes, expected);
  assert.deepEqual(createFullDeck().codes, expected);
});
