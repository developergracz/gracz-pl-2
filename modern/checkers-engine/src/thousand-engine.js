export const THOUSAND_PLAYERS = Object.freeze(["player-1", "player-2", "player-3"]);
export const THOUSAND_SUITS = Object.freeze(["spades", "clubs", "diamonds", "hearts"]);
export const THOUSAND_RANKS = Object.freeze(["9", "J", "Q", "K", "10", "A"]);
export const THOUSAND_CARD_POINTS = Object.freeze({ "9": 0, J: 2, Q: 3, K: 4, "10": 10, A: 11 });
export const THOUSAND_MARRIAGE_POINTS = Object.freeze({ spades: 40, clubs: 60, diamonds: 80, hearts: 100 });
export const THOUSAND_MIN_BID = 100;
export const THOUSAND_BID_STEP = 10;
export const THOUSAND_TARGET_SCORE = 1000;

export class ThousandRuleError extends Error {
  constructor(message, code = "THOUSAND_RULE_ERROR") {
    super(message);
    this.name = "ThousandRuleError";
    this.code = code;
  }
}

export function createThousandDeck() {
  return Object.freeze(THOUSAND_SUITS.flatMap((suit) =>
    THOUSAND_RANKS.map((rank) => Object.freeze({
      id: `${suit}-${rank}`,
      suit,
      rank,
      points: THOUSAND_CARD_POINTS[rank],
    }))
  ));
}

export function createThousandInitialState({ dealerIndex = 0, deck = createThousandDeck() } = {}) {
  assertDealerIndex(dealerIndex);
  validateDeck(deck);
  const hands = Object.fromEntries(THOUSAND_PLAYERS.map((player) => [player, []]));
  const talon = [];
  const firstPlayerIndex = (dealerIndex + 1) % THOUSAND_PLAYERS.length;
  const order = [0, 1, 2].map((offset) => (firstPlayerIndex + offset) % THOUSAND_PLAYERS.length);

  let cursor = 0;
  for (let round = 0; round < 7; round += 1) {
    for (const playerIndex of order) {
      hands[THOUSAND_PLAYERS[playerIndex]].push(deck[cursor++]);
    }
  }
  talon.push(deck[cursor++], deck[cursor++], deck[cursor++]);

  const state = {
    game: "thousand",
    version: 1,
    status: "bidding",
    dealerIndex,
    currentPlayerIndex: firstPlayerIndex,
    hands,
    talon,
    bid: {
      highest: null,
      highestBidderIndex: null,
      passed: [],
    },
    declarerIndex: null,
    contract: null,
    trumpSuit: null,
    trick: [],
    tricksWon: Object.fromEntries(THOUSAND_PLAYERS.map((player) => [player, []])),
    roundPoints: Object.fromEntries(THOUSAND_PLAYERS.map((player) => [player, 0])),
    scores: Object.fromEntries(THOUSAND_PLAYERS.map((player) => [player, 0])),
    history: [],
  };
  return freezeThousandState(state);
}

export function placeThousandBid(state, playerIndex, amount) {
  validateThousandState(state);
  assertBiddingTurn(state, playerIndex);
  const bid = Number(amount);
  if (!Number.isInteger(bid) || bid < THOUSAND_MIN_BID || bid % THOUSAND_BID_STEP !== 0) {
    throw new ThousandRuleError("Licytacja musi zaczynać się od 100 i rosnąć co 10 punktów.", "INVALID_BID");
  }
  if (state.bid.highest !== null && bid < state.bid.highest + THOUSAND_BID_STEP) {
    throw new ThousandRuleError("Nowa oferta musi być wyższa od aktualnej o co najmniej 10 punktów.", "BID_TOO_LOW");
  }
  if (state.bid.passed.includes(playerIndex)) {
    throw new ThousandRuleError("Gracz, który spasował, nie może wrócić do licytacji.", "PLAYER_ALREADY_PASSED");
  }

  const next = cloneState(state);
  next.bid.highest = bid;
  next.bid.highestBidderIndex = playerIndex;
  next.history.push({ type: "bid", playerIndex, amount: bid });
  advanceBidding(next);
  return freezeThousandState(next);
}

export function passThousandBid(state, playerIndex) {
  validateThousandState(state);
  assertBiddingTurn(state, playerIndex);
  if (state.bid.passed.includes(playerIndex)) {
    throw new ThousandRuleError("Gracz już spasował.", "PLAYER_ALREADY_PASSED");
  }

  const next = cloneState(state);
  next.bid.passed.push(playerIndex);
  next.history.push({ type: "pass", playerIndex });
  advanceBidding(next);
  return freezeThousandState(next);
}

export function getThousandMarriageValue(suit) {
  if (!THOUSAND_SUITS.includes(suit)) throw new ThousandRuleError("Nieznany kolor kart.", "INVALID_SUIT");
  return THOUSAND_MARRIAGE_POINTS[suit];
}

export function handHasMarriage(hand, suit) {
  if (!Array.isArray(hand)) throw new TypeError("Ręka gracza musi być tablicą kart.");
  if (!THOUSAND_SUITS.includes(suit)) throw new ThousandRuleError("Nieznany kolor kart.", "INVALID_SUIT");
  return hand.some((card) => card.suit === suit && card.rank === "K")
    && hand.some((card) => card.suit === suit && card.rank === "Q");
}

export function cardBeats(left, right, leadSuit, trumpSuit = null) {
  validateCard(left);
  validateCard(right);
  if (!THOUSAND_SUITS.includes(leadSuit)) throw new ThousandRuleError("Nieznany kolor wyjścia.", "INVALID_LEAD_SUIT");
  if (trumpSuit !== null && !THOUSAND_SUITS.includes(trumpSuit)) throw new ThousandRuleError("Nieznany kolor atutowy.", "INVALID_TRUMP_SUIT");
  if (left.suit === right.suit) return rankStrength(left.rank) > rankStrength(right.rank);
  if (trumpSuit && left.suit === trumpSuit && right.suit !== trumpSuit) return true;
  if (trumpSuit && right.suit === trumpSuit && left.suit !== trumpSuit) return false;
  if (left.suit === leadSuit && right.suit !== leadSuit) return true;
  return false;
}

export function serializeThousandState(state) {
  validateThousandState(state);
  return JSON.stringify(state);
}

export function deserializeThousandState(serialized) {
  let parsed;
  try { parsed = JSON.parse(serialized); }
  catch { throw new TypeError("Zapis Tysiąca nie jest prawidłowym JSON-em."); }
  validateThousandState(parsed);
  return freezeThousandState(cloneState(parsed));
}

function advanceBidding(state) {
  const active = [0, 1, 2].filter((index) => !state.bid.passed.includes(index));
  if (state.bid.highestBidderIndex !== null && active.length === 1) {
    state.status = "talon";
    state.declarerIndex = state.bid.highestBidderIndex;
    state.contract = state.bid.highest;
    state.currentPlayerIndex = state.declarerIndex;
    return;
  }

  for (let step = 1; step <= THOUSAND_PLAYERS.length; step += 1) {
    const candidate = (state.currentPlayerIndex + step) % THOUSAND_PLAYERS.length;
    if (!state.bid.passed.includes(candidate)) {
      state.currentPlayerIndex = candidate;
      return;
    }
  }

  if (state.bid.highestBidderIndex === null) {
    state.status = "redeal";
    state.currentPlayerIndex = null;
  }
}

function assertBiddingTurn(state, playerIndex) {
  if (state.status !== "bidding") throw new ThousandRuleError("Licytacja nie jest teraz aktywna.", "BIDDING_NOT_ACTIVE");
  assertPlayerIndex(playerIndex);
  if (state.currentPlayerIndex !== playerIndex) throw new ThousandRuleError("To nie jest kolej tego gracza.", "NOT_PLAYER_TURN");
}

function rankStrength(rank) {
  const index = THOUSAND_RANKS.indexOf(rank);
  if (index < 0) throw new ThousandRuleError("Nieznana figura karty.", "INVALID_RANK");
  return index;
}

function validateThousandState(state) {
  if (!state || state.game !== "thousand") throw new TypeError("Nieprawidłowy stan gry Tysiąc.");
  assertDealerIndex(state.dealerIndex);
  if (state.currentPlayerIndex !== null) assertPlayerIndex(state.currentPlayerIndex);
  if (!state.hands || !state.bid || !Array.isArray(state.talon)) throw new TypeError("Stan gry jest niekompletny.");
}

function validateDeck(deck) {
  if (!Array.isArray(deck) || deck.length !== 24) throw new TypeError("Tysiąc wymaga talii 24 kart.");
  const ids = new Set();
  for (const card of deck) { validateCard(card); ids.add(card.id); }
  if (ids.size !== 24) throw new TypeError("Talia Tysiąca nie może zawierać duplikatów.");
}

function validateCard(card) {
  if (!card || typeof card !== "object" || !THOUSAND_SUITS.includes(card.suit) || !THOUSAND_RANKS.includes(card.rank)) {
    throw new TypeError("Nieprawidłowa karta Tysiąca.");
  }
}

function assertDealerIndex(index) {
  assertPlayerIndex(index);
}

function assertPlayerIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= THOUSAND_PLAYERS.length) {
    throw new TypeError("Indeks gracza musi mieć wartość 0, 1 lub 2.");
  }
}

function cloneState(state) {
  return structuredClone(state);
}

function freezeThousandState(state) {
  for (const hand of Object.values(state.hands)) { hand.forEach(Object.freeze); Object.freeze(hand); }
  state.talon.forEach(Object.freeze); Object.freeze(state.talon);
  Object.freeze(state.hands);
  Object.freeze(state.bid.passed); Object.freeze(state.bid);
  state.trick.forEach(Object.freeze); Object.freeze(state.trick);
  for (const tricks of Object.values(state.tricksWon)) Object.freeze(tricks);
  Object.freeze(state.tricksWon);
  Object.freeze(state.roundPoints); Object.freeze(state.scores);
  state.history.forEach(Object.freeze); Object.freeze(state.history);
  return Object.freeze(state);
}
