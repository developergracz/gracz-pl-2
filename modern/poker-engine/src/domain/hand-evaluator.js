import { encodeCard } from "./card.js";

export const HAND_CATEGORIES = Object.freeze({
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

const CATEGORY_BY_RANK = Object.freeze([
  "HIGH_CARD",
  "ONE_PAIR",
  "TWO_PAIR",
  "THREE_OF_A_KIND",
  "STRAIGHT",
  "FLUSH",
  "FULL_HOUSE",
  "FOUR_OF_A_KIND",
  "STRAIGHT_FLUSH",
]);

const RANK_VALUE = Object.freeze({
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
});

const SUIT_CANONICAL_ORDER = Object.freeze({ c: 0, d: 1, h: 2, s: 3 });

export class HandEvaluationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HandEvaluationError";
    this.code = code;
  }
}

export function evaluateHoldemHand(holeCards, boardCards) {
  const hole = validateCardArray(holeCards, 2, "POKER_INVALID_HOLE_CARDS", "Hole cards");
  const board = validateCardArray(boardCards, 5, "POKER_INVALID_BOARD_CARDS", "Board cards");
  const seven = [...hole, ...board];

  const codes = seven.map((card) => canonicalCode(card));
  if (new Set(codes).size !== 7) {
    throw new HandEvaluationError("POKER_DUPLICATE_CARD", "Hold'em evaluation requires seven unique physical cards.");
  }

  let best = null;
  for (const five of combinationsOfFive(seven)) {
    const evaluation = evaluateFive(five);
    if (best === null) {
      best = evaluation;
      continue;
    }

    const rankComparison = compareRankTuples(evaluation.rankTuple, best.rankTuple);
    if (rankComparison > 0 || (rankComparison === 0 && compareRepresentation(evaluation, best) < 0)) {
      best = evaluation;
    }
  }

  return best;
}

export function compareEvaluations(a, b) {
  assertEvaluation(a);
  assertEvaluation(b);
  return compareRankTuples(a.rankTuple, b.rankTuple);
}

function evaluateFive(cards) {
  const groups = groupByRank(cards);
  const ranksDescending = cards.map(rankValue).sort((a, b) => b - a);
  const uniqueRanksDescending = [...new Set(ranksDescending)];
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straightHigh = findStraightHigh(uniqueRanksDescending);

  const counts = [...groups.entries()]
    .map(([rank, rankedCards]) => ({ rank, count: rankedCards.length }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  let categoryRank;
  let tieBreakers;

  if (flush && straightHigh !== null) {
    categoryRank = HAND_CATEGORIES.STRAIGHT_FLUSH;
    tieBreakers = [straightHigh];
  } else if (counts[0].count === 4) {
    categoryRank = HAND_CATEGORIES.FOUR_OF_A_KIND;
    const quadRank = counts[0].rank;
    const kicker = counts.find((entry) => entry.rank !== quadRank).rank;
    tieBreakers = [quadRank, kicker];
  } else if (counts[0].count === 3 && counts[1].count === 2) {
    categoryRank = HAND_CATEGORIES.FULL_HOUSE;
    tieBreakers = [counts[0].rank, counts[1].rank];
  } else if (flush) {
    categoryRank = HAND_CATEGORIES.FLUSH;
    tieBreakers = ranksDescending;
  } else if (straightHigh !== null) {
    categoryRank = HAND_CATEGORIES.STRAIGHT;
    tieBreakers = [straightHigh];
  } else if (counts[0].count === 3) {
    categoryRank = HAND_CATEGORIES.THREE_OF_A_KIND;
    const tripRank = counts[0].rank;
    const kickers = counts.filter((entry) => entry.rank !== tripRank).map((entry) => entry.rank).sort((a, b) => b - a);
    tieBreakers = [tripRank, ...kickers];
  } else {
    const pairs = counts.filter((entry) => entry.count === 2).map((entry) => entry.rank).sort((a, b) => b - a);
    if (pairs.length === 2) {
      categoryRank = HAND_CATEGORIES.TWO_PAIR;
      const kicker = counts.find((entry) => entry.count === 1).rank;
      tieBreakers = [pairs[0], pairs[1], kicker];
    } else if (pairs.length === 1) {
      categoryRank = HAND_CATEGORIES.ONE_PAIR;
      const pairRank = pairs[0];
      const kickers = counts.filter((entry) => entry.rank !== pairRank).map((entry) => entry.rank).sort((a, b) => b - a);
      tieBreakers = [pairRank, ...kickers];
    } else {
      categoryRank = HAND_CATEGORIES.HIGH_CARD;
      tieBreakers = ranksDescending;
    }
  }

  const category = CATEGORY_BY_RANK[categoryRank];
  const rankTuple = Object.freeze([categoryRank, ...tieBreakers]);
  const bestFive = Object.freeze(canonicalizeBestFive(cards, categoryRank, straightHigh));
  const displayLabel = categoryRank === HAND_CATEGORIES.STRAIGHT_FLUSH && straightHigh === 14
    ? "ROYAL_FLUSH"
    : undefined;

  const result = {
    category,
    categoryRank,
    rankTuple,
    bestFive,
  };
  if (displayLabel !== undefined) result.displayLabel = displayLabel;
  return Object.freeze(result);
}

function validateCardArray(cards, expectedLength, code, label) {
  if (!Array.isArray(cards) || cards.length !== expectedLength) {
    throw new HandEvaluationError(code, `${label} must contain exactly ${expectedLength} cards.`);
  }

  for (const card of cards) canonicalCode(card);
  return cards.slice();
}

function canonicalCode(card) {
  if (card === null || typeof card !== "object" || !Object.isFrozen(card) || typeof card.code !== "string") {
    throw new HandEvaluationError("POKER_INVALID_CARD", "Evaluator input must contain Card-compatible objects.");
  }

  let encoded;
  try {
    encoded = encodeCard(card);
  } catch {
    throw new HandEvaluationError("POKER_INVALID_CARD", "Evaluator input contains an invalid Card-compatible value.");
  }

  if (card.code !== encoded) {
    throw new HandEvaluationError("POKER_INVALID_CARD", "Card code does not match its rank and suit.");
  }
  return encoded;
}

function rankValue(card) {
  return RANK_VALUE[card.rank];
}

function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    const value = rankValue(card);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(card);
  }
  return groups;
}

function findStraightHigh(uniqueRanksDescending) {
  if (uniqueRanksDescending.length !== 5) return null;
  if (
    uniqueRanksDescending[0] === 14
    && uniqueRanksDescending[1] === 5
    && uniqueRanksDescending[2] === 4
    && uniqueRanksDescending[3] === 3
    && uniqueRanksDescending[4] === 2
  ) {
    return 5;
  }

  for (let index = 1; index < uniqueRanksDescending.length; index += 1) {
    if (uniqueRanksDescending[index - 1] - uniqueRanksDescending[index] !== 1) return null;
  }
  return uniqueRanksDescending[0];
}

function* combinationsOfFive(cards) {
  for (let a = 0; a < 3; a += 1) {
    for (let b = a + 1; b < 4; b += 1) {
      for (let c = b + 1; c < 5; c += 1) {
        for (let d = c + 1; d < 6; d += 1) {
          for (let e = d + 1; e < 7; e += 1) {
            yield [cards[a], cards[b], cards[c], cards[d], cards[e]];
          }
        }
      }
    }
  }
}

function compareRankTuples(a, b) {
  const maxLength = Math.max(a.length, b.length);
  for (let index = 0; index < maxLength; index += 1) {
    const left = a[index] ?? Number.NEGATIVE_INFINITY;
    const right = b[index] ?? Number.NEGATIVE_INFINITY;
    if (left !== right) return left > right ? 1 : -1;
  }
  return 0;
}

function canonicalizeBestFive(cards, categoryRank, straightHigh) {
  const normalizedRank = (card) => {
    const value = rankValue(card);
    if ((categoryRank === HAND_CATEGORIES.STRAIGHT || categoryRank === HAND_CATEGORIES.STRAIGHT_FLUSH) && straightHigh === 5 && value === 14) {
      return 1;
    }
    return value;
  };

  return cards.slice().sort((left, right) => {
    const rankDifference = normalizedRank(right) - normalizedRank(left);
    if (rankDifference !== 0) return rankDifference;
    return SUIT_CANONICAL_ORDER[left.suit] - SUIT_CANONICAL_ORDER[right.suit];
  });
}

function representationKey(evaluation) {
  return evaluation.bestFive.map((card) => card.code).join(":");
}

function compareRepresentation(a, b) {
  const left = representationKey(a);
  const right = representationKey(b);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function assertEvaluation(value) {
  if (
    value === null
    || typeof value !== "object"
    || !Array.isArray(value.rankTuple)
    || !Number.isInteger(value.categoryRank)
    || value.categoryRank < 0
    || value.categoryRank > 8
  ) {
    throw new HandEvaluationError("POKER_INVALID_EVALUATION", "A valid hand evaluation is required for comparison.");
  }
}
