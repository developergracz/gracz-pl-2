import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  HAND_CATEGORIES,
  HandEvaluationError,
  compareEvaluations,
  decodeCard,
  evaluateHoldemHand,
} from "../src/index.js";

const cards = (text) => text.trim().split(/\s+/).filter(Boolean).map(decodeCard);
const evaluate = (hole, board) => evaluateHoldemHand(cards(hole), cards(board));
const bestCodes = (evaluation) => evaluation.bestFive.map((card) => card.code);

test("E01 High Card selects the correct top five and kickers", () => {
  const result = evaluate("As 7d", "Kc Qh 9s 4d 2c");
  assert.equal(result.category, "HIGH_CARD");
  assert.deepEqual(result.rankTuple, [0, 14, 13, 12, 9, 7]);
});

test("E02 One Pair returns pair rank plus top three kickers", () => {
  const result = evaluate("Kc Kd", "As 9h 4c 3d 2s");
  assert.deepEqual(result.rankTuple, [1, 13, 14, 9, 4]);
});

test("E03 Two Pair returns highest two pairs plus kicker", () => {
  const result = evaluate("As Ad", "Tc Td Kh 3c 2s");
  assert.deepEqual(result.rankTuple, [2, 14, 10, 13]);
});

test("E04 Trips returns trips plus two kickers", () => {
  const result = evaluate("Qs Qd", "Qc Ah 9s 4d 2c");
  assert.deepEqual(result.rankTuple, [3, 12, 14, 9]);
});

test("E05 Straight uses only the straight high card", () => {
  const result = evaluate("9s 8d", "7c 6h 5s Kd 2c");
  assert.deepEqual(result.rankTuple, [4, 9]);
});

test("E06 Flush uses top five suited ranks descending", () => {
  const result = evaluate("As Js", "8s 5s 2s Kd Qc");
  assert.deepEqual(result.rankTuple, [5, 14, 11, 8, 5, 2]);
});

test("E07 Full House ranks trips first and pair second", () => {
  const result = evaluate("Qs Qd", "Qc 7h 7s 4d 2c");
  assert.deepEqual(result.rankTuple, [6, 12, 7]);
});

test("E08 Quads ranks quad first and kicker second", () => {
  const result = evaluate("8s 8d", "8c 8h As 4d 2c");
  assert.deepEqual(result.rankTuple, [7, 8, 14]);
});

test("E09 Straight Flush returns correct high rank", () => {
  const result = evaluate("Ks Qs", "Js Ts 9s 4d 2c");
  assert.equal(result.category, "STRAIGHT_FLUSH");
  assert.deepEqual(result.rankTuple, [8, 13]);
});

test("E10 Royal Flush remains STRAIGHT_FLUSH with display label", () => {
  const result = evaluate("As Ks", "Qs Js Ts 4d 2c");
  assert.equal(result.category, "STRAIGHT_FLUSH");
  assert.equal(result.categoryRank, 8);
  assert.deepEqual(result.rankTuple, [8, 14]);
  assert.equal(result.displayLabel, "ROYAL_FLUSH");
});

test("E11 Wheel A2345 is exactly five-high", () => {
  const result = evaluate("As 2d", "3c 4h 5s Kd Qc");
  assert.deepEqual(result.rankTuple, [4, 5]);
});

test("E12 Broadway TJQKA is Ace-high", () => {
  const result = evaluate("As Kd", "Qc Jh Ts 4d 2c");
  assert.deepEqual(result.rankTuple, [4, 14]);
});

test("E13 Ace wrap QKA23 and KA234 are not straights", () => {
  const first = evaluate("As Kd", "Qc 3h 2s 8d 7c");
  const second = evaluate("As Kd", "4c 3h 2s 9d 8c");
  assert.notEqual(first.category, "STRAIGHT");
  assert.notEqual(second.category, "STRAIGHT");
});

test("E14 Six-card flush selects only best five", () => {
  const result = evaluate("As Js", "9s 8s 5s 2s Kd");
  assert.deepEqual(result.rankTuple, [5, 14, 11, 9, 8, 5]);
  assert.equal(result.bestFive.length, 5);
  assert.equal(bestCodes(result).includes("2s"), false);
});

test("E15 Seven-card flush selects only best five", () => {
  const result = evaluate("As Ks", "Qs 9s 7s 4s 2s");
  assert.deepEqual(result.rankTuple, [5, 14, 13, 12, 9, 7]);
  assert.equal(result.bestFive.length, 5);
});

test("E16 Two trips uses highest trip and second trip as pair", () => {
  const result = evaluate("As Ad", "Ac Kd Kc Kh 2s");
  assert.deepEqual(result.rankTuple, [6, 14, 13]);
});

test("E17 Three pairs uses top two pairs and correct kicker", () => {
  const result = evaluate("As Ad", "Kc Kd Qh Qs 2c");
  assert.deepEqual(result.rankTuple, [2, 14, 13, 12]);
});

test("E18 Duplicate straight ranks do not prevent straight detection", () => {
  const result = evaluate("9s 9d", "8c 7h 6s 5d Kc");
  assert.deepEqual(result.rankTuple, [4, 9]);
});

test("E19 Board may play for both players and produce exact tie", () => {
  const board = "As Kd Qc Jh Ts";
  const first = evaluate("2c 3c", board);
  const second = evaluate("4d 5d", board);
  assert.equal(compareEvaluations(first, second), 0);
});

test("E20 Best hand may use zero hole cards", () => {
  const board = cards("As Kd Qc Jh Ts");
  const result = evaluateHoldemHand(cards("2c 3c"), board);
  assert.deepEqual(new Set(bestCodes(result)), new Set(board.map((card) => card.code)));
});

test("E21 Best hand may use exactly one hole card", () => {
  const result = evaluate("As 2d", "Kc Qh Js Ts 3c");
  assert.deepEqual(result.rankTuple, [4, 14]);
  assert.equal(bestCodes(result).includes("As"), true);
  assert.equal(bestCodes(result).includes("2d"), false);
});

test("E22 Best hand may use both hole cards", () => {
  const result = evaluate("As Ks", "Qc Jh Ts 4d 2c");
  assert.deepEqual(result.rankTuple, [4, 14]);
  assert.equal(bestCodes(result).includes("As"), true);
  assert.equal(bestCodes(result).includes("Ks"), true);
});

test("E23 Pair kicker tie-break is correct", () => {
  const better = evaluate("Kc Kd", "As 9h 4c 3d 2s");
  const worse = evaluate("Kh Ks", "Qs 9d 4h 3c 2d");
  assert.equal(compareEvaluations(better, worse) > 0, true);
});

test("E24 Two-pair kicker tie-break is correct", () => {
  const better = evaluate("As Ad", "Tc Td Kh 3c 2s");
  const worse = evaluate("Ah Ac", "Ts Th Qd 3d 2c");
  assert.equal(compareEvaluations(better, worse) > 0, true);
});

test("E25 Trips kicker tie-break is correct", () => {
  const better = evaluate("Qs Qd", "Qc Ah Ks 4d 2c");
  const worse = evaluate("Qh Qs", "Qd Ac Js 4c 2d");
  assert.equal(compareEvaluations(better, worse) > 0, true);
});

test("E26 Flush tie-break compares ranks lexicographically", () => {
  const better = evaluate("As Js", "8s 5s 3s Kd Qc");
  const worse = evaluate("Ah Jh", "8h 5h 2h Kd Qc");
  assert.deepEqual(better.rankTuple, [5, 14, 11, 8, 5, 3]);
  assert.deepEqual(worse.rankTuple, [5, 14, 11, 8, 5, 2]);
  assert.equal(compareEvaluations(better, worse) > 0, true);
});

test("E27 Full-house tie-break compares trip rank first", () => {
  const acesFull = evaluate("As Ad", "Ac Kd Kc 4h 2s");
  const kingsFull = evaluate("Ks Kd", "Kc Ah Ac 4d 2c");
  assert.equal(compareEvaluations(acesFull, kingsFull) > 0, true);
});

test("E28 Quads tie-break compares quad rank first", () => {
  const nines = evaluate("9s 9d", "9c 9h 2s Ad Kc");
  const eights = evaluate("8s 8d", "8c 8h As Kd Qc");
  assert.equal(compareEvaluations(nines, eights) > 0, true);
});

test("E29 Equal straight ranks are exact tie", () => {
  const first = evaluate("9s 8d", "7c 6h 5s Kd 2c");
  const second = evaluate("9h 8c", "7d 6s 5c Qh 2d");
  assert.equal(compareEvaluations(first, second), 0);
});

test("E30 Suit-only differences are exact tie", () => {
  const first = evaluate("As Kd", "Qc 9h 7s 4d 2c");
  const second = evaluate("Ah Ks", "Qd 9c 7h 4s 2d");
  assert.deepEqual(first.rankTuple, second.rankTuple);
  assert.equal(compareEvaluations(first, second), 0);
});

test("31 exactly two hole cards are required", () => {
  assert.throws(
    () => evaluateHoldemHand(cards("As"), cards("Kd Qc Jh Ts 2d")),
    (error) => error instanceof HandEvaluationError && error.code === "POKER_INVALID_HOLE_CARDS",
  );
});

test("32 exactly five board cards are required", () => {
  assert.throws(
    () => evaluateHoldemHand(cards("As Kd"), cards("Qc Jh Ts 2d")),
    (error) => error instanceof HandEvaluationError && error.code === "POKER_INVALID_BOARD_CARDS",
  );
});

test("33 duplicate physical card across hole and board is rejected", () => {
  assert.throws(
    () => evaluateHoldemHand(cards("As Kd"), cards("As Qc Jh Ts 2d")),
    (error) => error instanceof HandEvaluationError && error.code === "POKER_DUPLICATE_CARD",
  );
});

test("34 duplicate physical card inside board is rejected", () => {
  assert.throws(
    () => evaluateHoldemHand(cards("As Kd"), cards("Qc Qc Jh Ts 2d")),
    (error) => error instanceof HandEvaluationError && error.code === "POKER_DUPLICATE_CARD",
  );
});

test("35 invalid or non-Card-compatible input is rejected", () => {
  const goodBoard = cards("Qc Jh Ts 4d 2c");
  assert.throws(
    () => evaluateHoldemHand(["As", decodeCard("Kd")], goodBoard),
    (error) => error instanceof HandEvaluationError && error.code === "POKER_INVALID_CARD",
  );
  assert.throws(
    () => evaluateHoldemHand([{ rank: "A", suit: "s" }, decodeCard("Kd")], goodBoard),
    (error) => error instanceof HandEvaluationError && error.code === "POKER_INVALID_CARD",
  );
  assert.throws(
    () => evaluateHoldemHand([{ rank: "A", suit: "s", code: "As" }, decodeCard("Kd")], goodBoard),
    (error) => error instanceof HandEvaluationError && error.code === "POKER_INVALID_CARD",
  );
  assert.throws(
    () => evaluateHoldemHand([Object.freeze({ rank: "A", suit: "s", code: "Ah" }), decodeCard("Kd")], goodBoard),
    (error) => error instanceof HandEvaluationError && error.code === "POKER_INVALID_CARD",
  );
});

test("36 rankTuple is immutable", () => {
  const result = evaluate("As Kd", "Qc Jh Ts 4d 2c");
  assert.equal(Object.isFrozen(result.rankTuple), true);
  assert.throws(() => result.rankTuple.push(99), TypeError);
});

test("37 bestFive is immutable", () => {
  const result = evaluate("As Kd", "Qc Jh Ts 4d 2c");
  assert.equal(Object.isFrozen(result.bestFive), true);
  assert.throws(() => result.bestFive.pop(), TypeError);
});

test("38 evaluation result is immutable", () => {
  const result = evaluate("As Kd", "Qc Jh Ts 4d 2c");
  assert.equal(Object.isFrozen(result), true);
  assert.throws(() => { result.category = "HIGH_CARD"; }, TypeError);
});

test("39 evaluator is deterministic across repeated calls", () => {
  const hole = cards("9s 9d");
  const board = cards("8c 7h 6s 5d Kc");
  const first = evaluateHoldemHand(hole, board);
  const second = evaluateHoldemHand(hole, board);
  assert.deepEqual(first.rankTuple, second.rankTuple);
  assert.deepEqual(bestCodes(first), bestCodes(second));
  assert.equal(first.category, second.category);
});

test("40 source hole and board arrays are not mutated", () => {
  const hole = cards("As Kd");
  const board = cards("Qc Jh Ts 4d 2c");
  const holeBefore = hole.slice();
  const boardBefore = board.slice();
  evaluateHoldemHand(hole, board);
  assert.deepEqual(hole, holeBefore);
  assert.deepEqual(board, boardBefore);
  assert.equal(hole[0], holeBefore[0]);
  assert.equal(board[0], boardBefore[0]);
});

test("41 category ordering is exactly 0 through 8", () => {
  assert.deepEqual(HAND_CATEGORIES, {
    HIGH_CARD: 0,
    ONE_PAIR: 1,
    TWO_PAIR: 2,
    THREE_OF_A_KIND: 3,
    STRAIGHT: 4,
    FLUSH: 5,
    FULL_HOUSE: 6,
    FOUR_OF_A_KIND: 7,
    STRAIGHT_FLUSH: 8,
  });
  assert.equal(Object.isFrozen(HAND_CATEGORIES), true);
});

test("42 comparator is antisymmetric", () => {
  const a = evaluate("As Ad", "Kc Kd Qh 3c 2s");
  const b = evaluate("Kh Kc", "Qs Qd Jh 3d 2c");
  assert.equal(compareEvaluations(a, b), -compareEvaluations(b, a));
});

test("43 comparator self equality is zero", () => {
  const evaluation = evaluate("As Ad", "Kc Kd Qh 3c 2s");
  assert.equal(compareEvaluations(evaluation, evaluation), 0);
});

test("44 no suit-based tie breaking even for straight flush", () => {
  const spades = evaluate("9s 8s", "7s 6s 5s Kd 2c");
  const hearts = evaluate("9h 8h", "7h 6h 5h Qd 2c");
  assert.deepEqual(spades.rankTuple, hearts.rankTuple);
  assert.equal(compareEvaluations(spades, hearts), 0);
});

test("45 production evaluator contains no Math.random", async () => {
  const source = await readFile(new URL("../src/domain/hand-evaluator.js", import.meta.url), "utf8");
  assert.equal(source.includes("Math.random("), false);
});

test("46 evaluator imports no infrastructure dependency", async () => {
  const source = await readFile(new URL("../src/domain/hand-evaluator.js", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import\s+.*?from\s+["']([^"']+)["'];?$/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ["./card.js"]);
  for (const forbidden of ["pg", "postgres", "redis", "websocket", "ws", "http", "https", "fs", "net", "timers", "crypto", "ai"]) {
    assert.equal(imports.some((entry) => entry === forbidden || entry.startsWith(`node:${forbidden}`)), false);
  }
});
