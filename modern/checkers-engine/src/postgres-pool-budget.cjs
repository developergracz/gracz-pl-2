"use strict";

const DEFAULT_POSTGRES_POOL_MAX = 3;
const DEFAULT_POSTGRES_POOL_BUDGET = 64;

const POSTGRES_POOL_PROFILE = Object.freeze([
  Object.freeze({ id: "audit", file: "audit-service.js", max: 2, dedicatedListen: 0 }),
  Object.freeze({ id: "moderation", file: "moderation-service.js", max: 2, dedicatedListen: 0 }),
  Object.freeze({ id: "checkers-store", file: "postgres-session-store.js", max: 4, dedicatedListen: 0 }),
  Object.freeze({ id: "shared-traffic-guard", file: "distributed-infrastructure.js", max: 4, dedicatedListen: 0 }),
  Object.freeze({ id: "checkers-realtime", file: "distributed-infrastructure.js", max: 6, dedicatedListen: 1 }),
  Object.freeze({ id: "accounts", file: "postgres-accounts.js", max: 5, dedicatedListen: 0 }),
  Object.freeze({ id: "secure-accounts", file: "secure-accounts.js", max: 3, dedicatedListen: 0 }),
  Object.freeze({ id: "auth-sessions", file: "auth-sessions.js", max: 3, dedicatedListen: 0 }),
  Object.freeze({ id: "message-attachments", file: "message-attachments.js", max: 3, dedicatedListen: 0 }),
  Object.freeze({ id: "rbac", file: "rbac-service.js", max: 2, dedicatedListen: 0 }),
  Object.freeze({ id: "mfa", file: "mfa-service.js", max: 2, dedicatedListen: 0 }),
  Object.freeze({ id: "global-chat", file: "global-chat.js", max: DEFAULT_POSTGRES_POOL_MAX, dedicatedListen: 0, usesBootstrapDefault: true }),
  Object.freeze({ id: "tournaments", file: "tournaments.js", max: DEFAULT_POSTGRES_POOL_MAX, dedicatedListen: 0, usesBootstrapDefault: true }),
  Object.freeze({ id: "rankings", file: "rankings.js", max: 3, dedicatedListen: 0 }),
  Object.freeze({ id: "newsletter", file: "newsletter.js", max: 3, dedicatedListen: 0 }),
  Object.freeze({ id: "newsletter-admin", file: "newsletter-admin-service.js", max: 3, dedicatedListen: 0 }),
  Object.freeze({ id: "newsletter-lifecycle", file: "newsletter-lifecycle-recorder.js", max: 2, dedicatedListen: 0 }),
  Object.freeze({ id: "thousand", file: "thousand-repository.js", max: 5, dedicatedListen: 0 }),
  Object.freeze({ id: "gomoku", file: "postgres-gomoku-service.js", max: 4, dedicatedListen: 0 }),
]);

function parsePositiveInteger(value, name, maximum = 1_000_000) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new TypeError(`${name} musi być dodatnią liczbą całkowitą nie większą niż ${maximum}.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, name, maximum = 1_000_000) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new TypeError(`${name} musi być nieujemną liczbą całkowitą nie większą niż ${maximum}.`);
  }
  return parsed;
}

function aggregatePoolMax(profile = POSTGRES_POOL_PROFILE) {
  return profile.reduce((total, entry) => total + entry.max, 0);
}

function aggregateDedicatedListen(profile = POSTGRES_POOL_PROFILE) {
  return profile.reduce((total, entry) => total + entry.dedicatedListen, 0);
}

function configuredPoolBudget(environment = process.env) {
  return parsePositiveInteger(
    environment.POSTGRES_POOL_BUDGET ?? DEFAULT_POSTGRES_POOL_BUDGET,
    "POSTGRES_POOL_BUDGET",
    1024,
  );
}

function validateConfiguredPoolBudget(environment = process.env, profile = POSTGRES_POOL_PROFILE) {
  const budget = configuredPoolBudget(environment);
  const aggregateMax = aggregatePoolMax(profile);
  const dedicatedListen = aggregateDedicatedListen(profile);
  if (aggregateMax > budget) {
    const error = new TypeError(
      `POSTGRES_POOL_BUDGET=${budget} jest mniejszy niż profil aplikacji ${aggregateMax}.`,
    );
    error.code = "POSTGRES_POOL_BUDGET_EXCEEDED";
    error.budget = budget;
    error.aggregateMax = aggregateMax;
    throw error;
  }
  return Object.freeze({ budget, aggregateMax, dedicatedListen });
}

function connectionBudgetPlan({
  replicaCount,
  maxConnections,
  reservedConnections = 0,
  operationalHeadroom = null,
  environment = process.env,
  profile = POSTGRES_POOL_PROFILE,
} = {}) {
  const replicas = parsePositiveInteger(replicaCount, "POSTGRES_REPLICA_COUNT", 10_000);
  const max = parsePositiveInteger(maxConnections, "POSTGRES_MAX_CONNECTIONS", 1_000_000);
  const reserved = parseNonNegativeInteger(reservedConnections, "POSTGRES_RESERVED_CONNECTIONS", max);
  const configured = validateConfiguredPoolBudget(environment, profile);
  const dedicatedListenPerReplica = aggregateDedicatedListen(profile);
  const ordinaryPoolMaxPerReplica = aggregatePoolMax(profile) - dedicatedListenPerReplica;
  const dedicatedListenReservations = dedicatedListenPerReplica * replicas;
  const minimumHeadroom = Math.max(10, Math.ceil(max * 0.10));
  const headroom = operationalHeadroom === null || operationalHeadroom === undefined
    ? minimumHeadroom
    : Math.max(minimumHeadroom, parseNonNegativeInteger(operationalHeadroom, "POSTGRES_OPERATIONAL_HEADROOM", max));
  const safeOrdinaryQueryConnectionBudget = Math.max(0, max - reserved - dedicatedListenReservations - headroom);
  const configuredOrdinaryEnvelope = ordinaryPoolMaxPerReplica * replicas;
  const configuredTotalApplicationEnvelope = aggregatePoolMax(profile) * replicas;
  const safe = configuredOrdinaryEnvelope <= safeOrdinaryQueryConnectionBudget;
  return Object.freeze({
    replicaCount: replicas,
    maxConnections: max,
    reservedConnections: reserved,
    operationalHeadroom: headroom,
    configuredPoolBudgetPerReplica: configured.budget,
    profilePoolMaxPerReplica: configured.aggregateMax,
    ordinaryPoolMaxPerReplica,
    dedicatedListenPerReplica,
    dedicatedListenReservations,
    safeOrdinaryQueryConnectionBudget,
    configuredOrdinaryEnvelope,
    configuredTotalApplicationEnvelope,
    safe,
    formula: `${configuredOrdinaryEnvelope} <= ${max} - ${reserved} - ${dedicatedListenReservations} - ${headroom} = ${safeOrdinaryQueryConnectionBudget}`,
  });
}

function validateClusterConnectionBudget(input = {}) {
  const plan = connectionBudgetPlan(input);
  if (!plan.safe) {
    const error = new TypeError(`Niebezpieczna topologia PostgreSQL: ${plan.formula}.`);
    error.code = "POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED";
    error.plan = plan;
    throw error;
  }
  return plan;
}

module.exports = Object.freeze({
  DEFAULT_POSTGRES_POOL_MAX,
  DEFAULT_POSTGRES_POOL_BUDGET,
  POSTGRES_POOL_PROFILE,
  aggregatePoolMax,
  aggregateDedicatedListen,
  configuredPoolBudget,
  validateConfiguredPoolBudget,
  connectionBudgetPlan,
  validateClusterConnectionBudget,
});
