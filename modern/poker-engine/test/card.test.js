import assert from "node:assert/strict";
import test from "node:test";

import {
  CardValidationError,
  RANKS,
  SUITS,
  createCard,
  decodeCard,
  encodeCard,
} from "../src/index.js";

test("card constants expose exactly 13 ranks and 4 suits", () => {
  assert.deepEqual(RANKS, ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]);
  assert.deepEqual(SUITS, ["c", "d", "h", "s"]);
});

test("As, Td and 2c encode/decode canonically", () => {
  for (const code of ["As", "Td", "2c"]) {
    const card = decodeCard(code);
    assert.equal(card.code, code);
    assert.equal(encodeCard(card), code);
  }
});

test("invalid rank is rejected", () => {
  assert.throws(() => createCard("1", "s"), (error) => error instanceof CardValidationError && error.code === "POKER_INVALID_RANK");
});

test("invalid suit is rejected", () => {
  assert.throws(() => createCard("A", "x"), (error) => error instanceof CardValidationError && error.code === "POKER_INVALID_SUIT");
});

test("invalid card code length and format are rejected", () => {
  for (const code of ["A", "Ass", "10s", "as", "AX", "", null]) {
    assert.throws(() => decodeCard(code), CardValidationError);
  }
});

test("Card instances are immutable", () => {
  const card = createCard("A", "s");
  assert.equal(Object.isFrozen(card), true);
  assert.throws(() => { card.rank = "K"; }, TypeError);
  assert.equal(card.code, "As");
});
