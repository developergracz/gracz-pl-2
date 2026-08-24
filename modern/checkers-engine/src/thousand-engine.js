export const THOUSAND_PLAYERS = Object.freeze(["player-1", "player-2", "player-3"]);
export const THOUSAND_SUITS = Object.freeze(["spades", "clubs", "diamonds", "hearts"]);
export const THOUSAND_RANKS = Object.freeze(["9", "J", "Q", "K", "10", "A"]);
export const THOUSAND_CARD_POINTS = Object.freeze({ "9": 0, J: 2, Q: 3, K: 4, "10": 10, A: 11 });
export const THOUSAND_MARRIAGE_POINTS = Object.freeze({ spades: 40, clubs: 60, diamonds: 80, hearts: 100 });
export const THOUSAND_MIN_BID = 100;
export const THOUSAND_BID_STEP = 10;
export const THOUSAND_MAX_CONTRACT = 360;
export const THOUSAND_TARGET_SCORE = 1000;
export const THOUSAND_STATE_VERSION = 2;

export const DEFAULT_THOUSAND_RULES = Object.freeze({
  mustFollowSuit: true,
  mustTrumpWhenVoid: true,
  mustBeatWhenPossible: true,
  requireTrickBeforeMarriage: false,
  roundDefenderPointsToTen: true,
  targetScore: THOUSAND_TARGET_SCORE,
});

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

export function shuffleThousandDeck(deck = createThousandDeck(), random = Math.random) {
  validateDeck(deck);
  if (typeof random !== "function") throw new TypeError("Generator losowy musi być funkcją.");
  const shuffled = deck.map((card) => ({ ...card }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = Number(random());
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError("Generator losowy musi zwracać liczbę z zakresu [0, 1). ");
    const other = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return Object.freeze(shuffled.map(Object.freeze));
}

export function createThousandInitialState({
  dealerIndex = 0,
  deck = createThousandDeck(),
  scores = null,
  roundNumber = 1,
  rules = DEFAULT_THOUSAND_RULES,
} = {}) {
  assertDealerIndex(dealerIndex);
  validateDeck(deck);
  const normalizedRules = normalizeRules(rules);
  const normalizedScores = normalizeScores(scores);
  if (!Number.isInteger(roundNumber) || roundNumber < 1) throw new TypeError("Numer rozdania musi być dodatnią liczbą całkowitą.");

  const hands = Object.fromEntries(THOUSAND_PLAYERS.map((player) => [player, []]));
  const talon = [];
  const firstPlayerIndex = nextPlayerIndex(dealerIndex);
  const order = [0, 1, 2].map((offset) => (firstPlayerIndex + offset) % THOUSAND_PLAYERS.length);

  let cursor = 0;
  for (let round = 0; round < 7; round += 1) {
    for (const playerIndex of order) hands[playerKey(playerIndex)].push(cloneCard(deck[cursor++]));
  }
  talon.push(cloneCard(deck[cursor++]), cloneCard(deck[cursor++]), cloneCard(deck[cursor++]));

  return freezeThousandState({
    game: "thousand",
    version: THOUSAND_STATE_VERSION,
    roundNumber,
    status: "bidding",
    dealerIndex,
    currentPlayerIndex: firstPlayerIndex,
    leaderIndex: null,
    hands,
    talon,
    bid: { highest: null, highestBidderIndex: null, passed: [] },
    declarerIndex: null,
    contract: null,
    trumpSuit: null,
    trick: [],
    trickNumber: 0,
    tricksWon: emptyPlayerMap(() => []),
    cardPoints: emptyPlayerMap(() => 0),
    marriagePoints: emptyPlayerMap(() => 0),
    roundPoints: emptyPlayerMap(() => 0),
    scores: normalizedScores,
    marriagesDeclared: [],
    winnerIndex: null,
    roundResult: null,
    history: [],
    rules: normalizedRules,
  });
}

export function startNextThousandRound(state, { deck = createThousandDeck() } = {}) {
  validateThousandState(state);
  if (state.status !== "round-ended" && state.status !== "game-ended" && state.status !== "redeal") {
    throw new ThousandRuleError("Kolejne rozdanie można rozpocząć dopiero po zakończeniu bieżącego.", "ROUND_NOT_FINISHED");
  }
  return createThousandInitialState({
    dealerIndex: nextPlayerIndex(state.dealerIndex),
    deck,
    scores: state.scores,
    roundNumber: state.roundNumber + 1,
    rules: state.rules,
  });
}

export function placeThousandBid(state, playerIndex, amount) {
  validateThousandState(state);
  assertBiddingTurn(state, playerIndex);
  const bid = normalizeContractValue(amount, "INVALID_BID");
  if (state.bid.highest !== null && bid < state.bid.highest + THOUSAND_BID_STEP) {
    throw new ThousandRuleError("Nowa oferta musi być wyższa od aktualnej o co najmniej 10 punktów.", "BID_TOO_LOW");
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
  const next = cloneState(state);
  next.bid.passed.push(playerIndex);
  next.history.push({ type: "pass", playerIndex });
  advanceBidding(next);
  return freezeThousandState(next);
}

export function takeThousandTalon(state, playerIndex) {
  validateThousandState(state);
  assertStatus(state, "talon");
  assertDeclarer(state, playerIndex);
  if (state.talon.length !== 3) throw new ThousandRuleError("Musik musi zawierać dokładnie 3 karty.", "INVALID_TALON");
  const next = cloneState(state);
  const key = playerKey(playerIndex);
  next.hands[key].push(...next.talon.map(cloneCard));
  next.history.push({ type: "talon-taken", playerIndex, cards: next.talon.map((card) => card.id) });
  next.talon = [];
  next.status = "discard";
  next.currentPlayerIndex = playerIndex;
  return freezeThousandState(next);
}

export function giveThousandCards(state, playerIndex, gifts) {
  validateThousandState(state);
  assertStatus(state, "discard");
  assertDeclarer(state, playerIndex);
  if (!Array.isArray(gifts) || gifts.length !== 2) {
    throw new ThousandRuleError("Rozgrywający musi przekazać po jednej karcie obu przeciwnikom.", "INVALID_GIFTS");
  }
  const recipients = new Set();
  const cardIds = new Set();
  for (const gift of gifts) {
    assertPlayerIndex(gift?.toPlayerIndex);
    if (gift.toPlayerIndex === playerIndex) throw new ThousandRuleError("Nie można przekazać karty samemu sobie.", "INVALID_GIFT_RECIPIENT");
    if (recipients.has(gift.toPlayerIndex)) throw new ThousandRuleError("Każdy przeciwnik musi otrzymać dokładnie jedną kartę.", "DUPLICATE_GIFT_RECIPIENT");
    if (typeof gift.cardId !== "string" || cardIds.has(gift.cardId)) throw new ThousandRuleError("Każda przekazywana karta musi być unikalna.", "INVALID_GIFT_CARD");
    recipients.add(gift.toPlayerIndex);
    cardIds.add(gift.cardId);
  }
  if (recipients.size !== 2) throw new ThousandRuleError("Karty muszą trafić do obu przeciwników.", "INVALID_GIFTS");

  const next = cloneState(state);
  const sourceKey = playerKey(playerIndex);
  for (const gift of gifts) {
    const cardIndex = next.hands[sourceKey].findIndex((card) => card.id === gift.cardId);
    if (cardIndex < 0) throw new ThousandRuleError("Przekazywanej karty nie ma w ręce rozgrywającego.", "CARD_NOT_IN_HAND");
    const [card] = next.hands[sourceKey].splice(cardIndex, 1);
    next.hands[playerKey(gift.toPlayerIndex)].push(card);
  }
  if (Object.values(next.hands).some((hand) => hand.length !== 8)) throw new ThousandRuleError("Po przekazaniu kart każdy gracz musi mieć 8 kart.", "INVALID_HAND_SIZE");
  next.history.push({ type: "cards-given", playerIndex, gifts: gifts.map((gift) => ({ ...gift })) });
  next.status = "contract";
  return freezeThousandState(next);
}

export function declareThousandContract(state, playerIndex, amount) {
  validateThousandState(state);
  assertStatus(state, "contract");
  assertDeclarer(state, playerIndex);
  const contract = normalizeContractValue(amount, "INVALID_CONTRACT");
  if (contract < state.bid.highest) throw new ThousandRuleError("Kontrakt nie może być niższy od wygranej licytacji.", "CONTRACT_BELOW_BID");
  const next = cloneState(state);
  next.contract = contract;
  next.status = "playing";
  next.leaderIndex = playerIndex;
  next.currentPlayerIndex = playerIndex;
  next.history.push({ type: "contract", playerIndex, amount: contract });
  return freezeThousandState(next);
}

export function getLegalThousandCards(state, playerIndex) {
  validateThousandState(state);
  assertStatus(state, "playing");
  assertPlayerIndex(playerIndex);
  if (state.currentPlayerIndex !== playerIndex) return [];
  const hand = state.hands[playerKey(playerIndex)];
  if (state.trick.length === 0) return hand.map((card) => card.id);

  const leadSuit = state.trick[0].card.suit;
  const follow = hand.filter((card) => card.suit === leadSuit);
  if (state.rules.mustFollowSuit && follow.length > 0) {
    return mustBeatSubset(state, follow).map((card) => card.id);
  }

  if (state.rules.mustTrumpWhenVoid && state.trumpSuit) {
    const trumps = hand.filter((card) => card.suit === state.trumpSuit);
    if (trumps.length > 0) return mustBeatSubset(state, trumps).map((card) => card.id);
  }

  return hand.map((card) => card.id);
}

export function playThousandCard(state, playerIndex, cardId, { declareMarriage = false } = {}) {
  validateThousandState(state);
  assertStatus(state, "playing");
  assertPlayerIndex(playerIndex);
  if (state.currentPlayerIndex !== playerIndex) throw new ThousandRuleError("To nie jest kolej tego gracza.", "NOT_PLAYER_TURN");
  const legal = getLegalThousandCards(state, playerIndex);
  if (!legal.includes(cardId)) throw new ThousandRuleError("Ta karta nie może być teraz zagrana.", "ILLEGAL_CARD");

  const next = cloneState(state);
  const hand = next.hands[playerKey(playerIndex)];
  const cardIndex = hand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new ThousandRuleError("Karty nie ma w ręce gracza.", "CARD_NOT_IN_HAND");
  const [card] = hand.splice(cardIndex, 1);

  if (declareMarriage) declareMarriageOnLead(next, playerIndex, card);
  next.trick.push({ playerIndex, card });
  next.history.push({ type: "card", playerIndex, cardId: card.id, marriage: Boolean(declareMarriage) });

  if (next.trick.length < THOUSAND_PLAYERS.length) {
    next.currentPlayerIndex = nextPlayerIndex(playerIndex);
    return freezeThousandState(next);
  }

  resolveTrick(next);
  if (Object.values(next.hands).every((cards) => cards.length === 0)) finishRound(next);
  return freezeThousandState(next);
}

export function getThousandMarriageValue(suit) {
  assertSuit(suit);
  return THOUSAND_MARRIAGE_POINTS[suit];
}

export function handHasMarriage(hand, suit) {
  if (!Array.isArray(hand)) throw new TypeError("Ręka gracza musi być tablicą kart.");
  assertSuit(suit);
  return hand.some((card) => card.suit === suit && card.rank === "K")
    && hand.some((card) => card.suit === suit && card.rank === "Q");
}

export function cardBeats(left, right, leadSuit, trumpSuit = null) {
  validateCard(left);
  validateCard(right);
  assertSuit(leadSuit);
  if (trumpSuit !== null) assertSuit(trumpSuit);
  if (left.suit === right.suit) return rankStrength(left.rank) > rankStrength(right.rank);
  if (trumpSuit && left.suit === trumpSuit && right.suit !== trumpSuit) return true;
  if (trumpSuit && right.suit === trumpSuit && left.suit !== trumpSuit) return false;
  if (left.suit === leadSuit && right.suit !== leadSuit) return true;
  return false;
}

export function thousandPublicView(state, viewerIndex = null) {
  validateThousandState(state);
  if (viewerIndex !== null) assertPlayerIndex(viewerIndex);
  const view = cloneState(state);
  for (let index = 0; index < THOUSAND_PLAYERS.length; index += 1) {
    if (index === viewerIndex) continue;
    const key = playerKey(index);
    view.hands[key] = view.hands[key].map(() => ({ id: "hidden", hidden: true }));
  }
  if (state.status === "bidding" || state.status === "talon") {
    view.talon = view.talon.map(() => ({ id: "hidden", hidden: true }));
  }
  return view;
}

export function applyThousandAction(state, action) {
  if (!action || typeof action !== "object") throw new TypeError("Akcja gry jest wymagana.");
  switch (action.type) {
    case "bid": return placeThousandBid(state, action.playerIndex, action.amount);
    case "pass": return passThousandBid(state, action.playerIndex);
    case "take-talon": return takeThousandTalon(state, action.playerIndex);
    case "give-cards": return giveThousandCards(state, action.playerIndex, action.gifts);
    case "contract": return declareThousandContract(state, action.playerIndex, action.amount);
    case "play-card": return playThousandCard(state, action.playerIndex, action.cardId, { declareMarriage: action.declareMarriage === true });
    default: throw new ThousandRuleError("Nieznany typ akcji Tysiąca.", "UNKNOWN_ACTION");
  }
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
  if (active.length === 0 || (state.bid.highestBidderIndex === null && active.length === 1)) {
    state.status = "redeal";
    state.currentPlayerIndex = null;
    return;
  }
  for (let step = 1; step <= THOUSAND_PLAYERS.length; step += 1) {
    const candidate = (state.currentPlayerIndex + step) % THOUSAND_PLAYERS.length;
    if (!state.bid.passed.includes(candidate)) {
      state.currentPlayerIndex = candidate;
      return;
    }
  }
}

function mustBeatSubset(state, candidates) {
  if (!state.rules.mustBeatWhenPossible || state.trick.length === 0) return candidates;
  const leadSuit = state.trick[0].card.suit;
  const winning = winningPlay(state.trick, leadSuit, state.trumpSuit);
  const beating = candidates.filter((card) => cardBeats(card, winning.card, leadSuit, state.trumpSuit));
  return beating.length > 0 ? beating : candidates;
}

function declareMarriageOnLead(state, playerIndex, card) {
  if (state.trick.length !== 0) throw new ThousandRuleError("Meldunek można zgłosić tylko przy wyjściu do lewy.", "MARRIAGE_NOT_ON_LEAD");
  if (card.rank !== "K" && card.rank !== "Q") throw new ThousandRuleError("Meldunek można zgłosić tylko królem lub damą.", "INVALID_MARRIAGE_CARD");
  if (state.marriagesDeclared.some((entry) => entry.playerIndex === playerIndex && entry.suit === card.suit)) {
    throw new ThousandRuleError("Ten meldunek został już zgłoszony.", "MARRIAGE_ALREADY_DECLARED");
  }
  const handWithPlayedCard = [...state.hands[playerKey(playerIndex)], card];
  if (!handHasMarriage(handWithPlayedCard, card.suit)) throw new ThousandRuleError("Gracz nie ma pary król-dama tego koloru.", "MARRIAGE_NOT_HELD");
  if (state.rules.requireTrickBeforeMarriage && state.tricksWon[playerKey(playerIndex)].length === 0) {
    throw new ThousandRuleError("Najpierw trzeba zdobyć co najmniej jedną lewę.", "MARRIAGE_REQUIRES_TRICK");
  }
  const points = getThousandMarriageValue(card.suit);
  state.marriagePoints[playerKey(playerIndex)] += points;
  state.roundPoints[playerKey(playerIndex)] += points;
  state.trumpSuit = card.suit;
  state.marriagesDeclared.push({ playerIndex, suit: card.suit, points, trickNumber: state.trickNumber + 1 });
  state.history.push({ type: "marriage", playerIndex, suit: card.suit, points });
}

function resolveTrick(state) {
  const leadSuit = state.trick[0].card.suit;
  const winner = winningPlay(state.trick, leadSuit, state.trumpSuit);
  const points = state.trick.reduce((sum, play) => sum + play.card.points, 0);
  const winnerKey = playerKey(winner.playerIndex);
  state.cardPoints[winnerKey] += points;
  state.roundPoints[winnerKey] += points;
  state.tricksWon[winnerKey].push(state.trick.map((play) => ({ playerIndex: play.playerIndex, card: cloneCard(play.card) })));
  state.trickNumber += 1;
  state.history.push({ type: "trick", trickNumber: state.trickNumber, winnerIndex: winner.playerIndex, points });
  state.trick = [];
  state.leaderIndex = winner.playerIndex;
  state.currentPlayerIndex = winner.playerIndex;
}

function winningPlay(trick, leadSuit, trumpSuit) {
  return trick.reduce((winner, play) => cardBeats(play.card, winner.card, leadSuit, trumpSuit) ? play : winner);
}

function finishRound(state) {
  const declarerKey = playerKey(state.declarerIndex);
  const declarerRaw = state.roundPoints[declarerKey];
  const madeContract = declarerRaw >= state.contract;
  const deltas = emptyPlayerMap(() => 0);
  for (let index = 0; index < THOUSAND_PLAYERS.length; index += 1) {
    const key = playerKey(index);
    if (index === state.declarerIndex) deltas[key] = madeContract ? state.contract : -state.contract;
    else deltas[key] = state.rules.roundDefenderPointsToTen ? roundToNearestTen(state.roundPoints[key]) : state.roundPoints[key];
    state.scores[key] += deltas[key];
  }
  const target = state.rules.targetScore;
  const winners = [0, 1, 2].filter((index) => state.scores[playerKey(index)] >= target);
  state.roundResult = { declarerIndex: state.declarerIndex, contract: state.contract, madeContract, rawPoints: cloneState(state.roundPoints), scoreDeltas: deltas };
  state.currentPlayerIndex = null;
  state.leaderIndex = null;
  if (winners.length > 0) {
    winners.sort((a, b) => state.scores[playerKey(b)] - state.scores[playerKey(a)]);
    state.winnerIndex = winners[0];
    state.status = "game-ended";
  } else {
    state.status = "round-ended";
  }
  state.history.push({ type: "round-ended", result: cloneState(state.roundResult), scores: cloneState(state.scores) });
}

function roundToNearestTen(value) {
  return Math.round(Number(value) / 10) * 10;
}

function assertBiddingTurn(state, playerIndex) {
  assertStatus(state, "bidding");
  assertPlayerIndex(playerIndex);
  if (state.currentPlayerIndex !== playerIndex) throw new ThousandRuleError("To nie jest kolej tego gracza.", "NOT_PLAYER_TURN");
  if (state.bid.passed.includes(playerIndex)) throw new ThousandRuleError("Gracz, który spasował, nie może wrócić do licytacji.", "PLAYER_ALREADY_PASSED");
}

function assertDeclarer(state, playerIndex) {
  assertPlayerIndex(playerIndex);
  if (state.declarerIndex !== playerIndex) throw new ThousandRuleError("Tę akcję może wykonać wyłącznie rozgrywający.", "NOT_DECLARER");
}

function assertStatus(state, expected) {
  if (state.status !== expected) throw new ThousandRuleError(`Akcja wymaga etapu: ${expected}.`, "INVALID_GAME_PHASE");
}

function normalizeContractValue(amount, code) {
  const value = Number(amount);
  if (!Number.isInteger(value) || value < THOUSAND_MIN_BID || value > THOUSAND_MAX_CONTRACT || value % THOUSAND_BID_STEP !== 0) {
    throw new ThousandRuleError(`Wartość musi mieścić się w zakresie ${THOUSAND_MIN_BID}-${THOUSAND_MAX_CONTRACT} i być wielokrotnością ${THOUSAND_BID_STEP}.`, code);
  }
  return value;
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
  if (state.declarerIndex !== null) assertPlayerIndex(state.declarerIndex);
  if (!state.hands || !state.bid || !Array.isArray(state.talon) || !Array.isArray(state.trick)) throw new TypeError("Stan gry jest niekompletny.");
  for (const key of THOUSAND_PLAYERS) if (!Array.isArray(state.hands[key])) throw new TypeError("Brakuje ręki gracza.");
}

function validateDeck(deck) {
  if (!Array.isArray(deck) || deck.length !== 24) throw new TypeError("Tysiąc wymaga talii 24 kart.");
  const ids = new Set();
  for (const card of deck) { validateCard(card); ids.add(card.id); }
  if (ids.size !== 24) throw new TypeError("Talia Tysiąca nie może zawierać duplikatów.");
}

function validateCard(card) {
  if (!card || typeof card !== "object" || !THOUSAND_SUITS.includes(card.suit) || !THOUSAND_RANKS.includes(card.rank)) throw new TypeError("Nieprawidłowa karta Tysiąca.");
  if (card.id !== `${card.suit}-${card.rank}`) throw new TypeError("Identyfikator karty jest nieprawidłowy.");
}

function normalizeScores(scores) {
  const result = emptyPlayerMap(() => 0);
  if (scores === null || scores === undefined) return result;
  for (const key of THOUSAND_PLAYERS) {
    const value = Number(scores[key] ?? 0);
    if (!Number.isInteger(value)) throw new TypeError("Wynik gracza musi być liczbą całkowitą.");
    result[key] = value;
  }
  return result;
}

function normalizeRules(rules) {
  const merged = { ...DEFAULT_THOUSAND_RULES, ...(rules ?? {}) };
  if (!Number.isInteger(merged.targetScore) || merged.targetScore < 100) throw new TypeError("Docelowy wynik gry jest nieprawidłowy.");
  for (const field of ["mustFollowSuit", "mustTrumpWhenVoid", "mustBeatWhenPossible", "requireTrickBeforeMarriage", "roundDefenderPointsToTen"]) {
    if (typeof merged[field] !== "boolean") throw new TypeError(`Reguła ${field} musi być wartością logiczną.`);
  }
  return merged;
}

function assertSuit(suit) {
  if (!THOUSAND_SUITS.includes(suit)) throw new ThousandRuleError("Nieznany kolor kart.", "INVALID_SUIT");
}

function assertDealerIndex(index) { assertPlayerIndex(index); }
function assertPlayerIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= THOUSAND_PLAYERS.length) throw new TypeError("Indeks gracza musi mieć wartość 0, 1 lub 2.");
}
function nextPlayerIndex(index) { return (index + 1) % THOUSAND_PLAYERS.length; }
function playerKey(index) { assertPlayerIndex(index); return THOUSAND_PLAYERS[index]; }
function emptyPlayerMap(factory) { return Object.fromEntries(THOUSAND_PLAYERS.map((key, index) => [key, factory(index)])); }
function cloneCard(card) { return { ...card }; }
function cloneState(value) { return structuredClone(value); }

function freezeThousandState(state) {
  return deepFreeze(state);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
