"use strict";

const DEFAULT_POSTGRES_POOL_MAX = 3;
const MAX_POSTGRES_REPLICA_COUNT = 1024;

function frozenEntry(entry) {
  return Object.freeze({
    ...entry,
    embeddedPersistentListeners: Object.freeze([...(entry.embeddedPersistentListeners || [])].map(Object.freeze)),
  });
}

const POSTGRES_RESOURCE_PROFILE = Object.freeze({
  pools: Object.freeze([
    frozenEntry({ id: "audit", owner: "AuditService", file: "audit-service.js", max: 2, mainConstructor: "new AuditService(config.databaseUrl||null)" }),
    frozenEntry({ id: "moderation", owner: "ModerationService", file: "moderation-service.js", max: 2, mainConstructor: "new ModerationService(config.databaseUrl||null" }),
    frozenEntry({ id: "checkers-store", owner: "PostgresSessionStore", file: "postgres-session-store.js", max: 4, mainConstructor: "new PostgresSessionStore(config.databaseUrl)" }),
    frozenEntry({ id: "shared-traffic-guard", owner: "PostgresDistributedTrafficGuard", file: "distributed-infrastructure.js", max: 4, mainConstructor: "new PostgresDistributedTrafficGuard(config.databaseUrl)" }),
    frozenEntry({
      id: "checkers-realtime",
      owner: "PostgresRealtimeHub",
      file: "distributed-infrastructure.js",
      max: 6,
      mainConstructor: "new PostgresRealtimeHub(config.databaseUrl",
      embeddedPersistentListeners: [{ id: "checkers-realtime-listen", count: 1 }],
    }),
    frozenEntry({ id: "accounts", owner: "PostgresAccountService", file: "postgres-accounts.js", max: 5, mainConstructor: "new PostgresAccountService(config.databaseUrl" }),
    frozenEntry({ id: "message-attachments", owner: "MessageAttachmentService", file: "message-attachments.js", max: 3, mainConstructor: "new MessageAttachmentService(config.databaseUrl" }),
    frozenEntry({ id: "rbac", owner: "RbacService", file: "rbac-service.js", max: 2, mainConstructor: "new RbacService(config.databaseUrl||null" }),
    frozenEntry({ id: "mfa", owner: "MfaService", file: "mfa-service.js", max: 2, mainConstructor: "new MfaService(config.databaseUrl||null" }),
    frozenEntry({ id: "tournaments", owner: "TournamentService", file: "tournaments.js", max: DEFAULT_POSTGRES_POOL_MAX, mainConstructor: "new TournamentService(config.databaseUrl||null)", usesDefaultPoolMax: true }),
    frozenEntry({ id: "rankings", owner: "RankingService", file: "rankings.js", max: 3, mainConstructor: "new RankingService(config.databaseUrl||null)" }),
    frozenEntry({ id: "newsletter", owner: "NewsletterService", file: "newsletter.js", max: 3, mainConstructor: "new NewsletterService(config.databaseUrl||null" }),
    frozenEntry({ id: "newsletter-admin", owner: "NewsletterAdminService", file: "newsletter-admin-service.js", max: 3, mainConstructor: "new NewsletterAdminService(config.databaseUrl||null)" }),
    frozenEntry({ id: "newsletter-lifecycle", owner: "NewsletterLifecycleRecorder", file: "newsletter-lifecycle-recorder.js", max: 2, mainConstructor: "new NewsletterLifecycleRecorder(config.databaseUrl||null)" }),
    frozenEntry({
      id: "thousand",
      owner: "PostgresThousandRepository",
      file: "thousand-repository.js",
      max: 5,
      mainConstructor: "new PostgresThousandRepository(config.databaseUrl)",
      embeddedPersistentListeners: [{ id: "thousand-realtime-listen", count: 1 }],
    }),
    frozenEntry({
      id: "gomoku",
      owner: "PostgresGomokuService",
      file: "postgres-gomoku-service.js",
      max: 4,
      mainConstructor: "new PostgresGomokuService(config.databaseUrl)",
      embeddedPersistentListeners: [{ id: "gomoku-realtime-listen", count: 1 }],
    }),
  ]),
  externalPersistentClients: Object.freeze([
    Object.freeze({
      id: "global-chat-listen",
      owner: "DistributedGlobalChatService",
      file: "distributed-global-chat.js",
      count: 1,
      mainConstructor: "new DistributedGlobalChatService({pool:store.pool",
    }),
  ]),
  startupTemporaryClients: Object.freeze([
    Object.freeze({
      id: "startup-schema-lock",
      owner: "Postgres startup schema lock",
      file: "postgres-startup-schema-lock.js",
      count: 1,
    }),
  ]),
  clusterGlobalClients: Object.freeze([]),
});

const POSTGRES_POOL_PROFILE = POSTGRES_RESOURCE_PROFILE.pools;

function parsePositiveInteger(value, name, maximum = 1_000_000) {
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
    throw new TypeError(`${name} musi być dodatnią liczbą całkowitą nie większą niż ${maximum}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new TypeError(`${name} musi być dodatnią liczbą całkowitą nie większą niż ${maximum}.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, name, maximum = 1_000_000) {
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
    throw new TypeError(`${name} musi być nieujemną liczbą całkowitą nie większą niż ${maximum}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new TypeError(`${name} musi być nieujemną liczbą całkowitą nie większą niż ${maximum}.`);
  }
  return parsed;
}

function resourceProfile(profile = POSTGRES_RESOURCE_PROFILE) {
  if (Array.isArray(profile)) {
    return Object.freeze({
      pools: profile,
      externalPersistentClients: Object.freeze([]),
      startupTemporaryClients: Object.freeze([]),
      clusterGlobalClients: Object.freeze([]),
    });
  }
  if (!profile || !Array.isArray(profile.pools)) throw new TypeError("Nieprawidłowy profil zasobów PostgreSQL.");
  return profile;
}

function aggregatePoolMax(profile = POSTGRES_RESOURCE_PROFILE) {
  return resourceProfile(profile).pools.reduce((total, entry) => total + parsePositiveInteger(entry.max, `Pool max (${entry.id || "unknown"})`, 1024), 0);
}

function aggregateEmbeddedPersistentListeners(profile = POSTGRES_RESOURCE_PROFILE) {
  return resourceProfile(profile).pools.reduce(
    (total, entry) => total + (entry.embeddedPersistentListeners || []).reduce(
      (subtotal, listener) => subtotal + parseNonNegativeInteger(listener.count ?? 0, `Embedded listener count (${listener.id || "unknown"})`, 1024),
      0,
    ),
    0,
  );
}

function aggregateExternalPersistentClients(profile = POSTGRES_RESOURCE_PROFILE) {
  return resourceProfile(profile).externalPersistentClients.reduce(
    (total, entry) => total + parseNonNegativeInteger(entry.count ?? 0, `External persistent client count (${entry.id || "unknown"})`, 1024),
    0,
  );
}

function aggregateStartupTemporaryClients(profile = POSTGRES_RESOURCE_PROFILE) {
  return resourceProfile(profile).startupTemporaryClients.reduce(
    (total, entry) => total + parseNonNegativeInteger(entry.count ?? 0, `Startup client count (${entry.id || "unknown"})`, 1024),
    0,
  );
}

function aggregateClusterGlobalClients(profile = POSTGRES_RESOURCE_PROFILE) {
  return resourceProfile(profile).clusterGlobalClients.reduce(
    (total, entry) => total + parseNonNegativeInteger(entry.count ?? 0, `Cluster-global client count (${entry.id || "unknown"})`, 1024),
    0,
  );
}

function requestedPoolBudget(environment = process.env, profile = POSTGRES_RESOURCE_PROFILE) {
  const canonical = aggregatePoolMax(profile);
  if (environment.POSTGRES_POOL_BUDGET === undefined || environment.POSTGRES_POOL_BUDGET === null || environment.POSTGRES_POOL_BUDGET === "") {
    return canonical;
  }
  return parsePositiveInteger(environment.POSTGRES_POOL_BUDGET, "POSTGRES_POOL_BUDGET", 1024);
}

function configuredPoolBudget(environment = process.env, profile = POSTGRES_RESOURCE_PROFILE) {
  const canonical = aggregatePoolMax(profile);
  const requested = requestedPoolBudget(environment, profile);
  if (requested < canonical) {
    const error = new TypeError(
      `POSTGRES_POOL_BUDGET=${requested} jest mniejszy niż kanoniczny profil produkcyjny ${canonical}.`,
    );
    error.code = "POSTGRES_POOL_BUDGET_EXCEEDED";
    error.budget = requested;
    error.aggregateMax = canonical;
    throw error;
  }
  // An override may be stricter by failing below the canonical profile, but it may never
  // widen the process-local production allocation envelope beyond the canonical profile.
  return canonical;
}

function validateConfiguredPoolBudget(environment = process.env, profile = POSTGRES_RESOURCE_PROFILE) {
  const canonical = aggregatePoolMax(profile);
  const requested = requestedPoolBudget(environment, profile);
  const budget = configuredPoolBudget(environment, profile);
  return Object.freeze({
    budget,
    requestedBudget: requested,
    aggregateMax: canonical,
    embeddedPersistentListeners: aggregateEmbeddedPersistentListeners(profile),
    externalPersistentClients: aggregateExternalPersistentClients(profile),
    startupTemporaryClients: aggregateStartupTemporaryClients(profile),
    clusterGlobalClients: aggregateClusterGlobalClients(profile),
  });
}

function resolvePostgresReplicaCount(
  environment = process.env,
  {
    databaseUrl = typeof environment.DATABASE_URL === "string" ? environment.DATABASE_URL.trim() : "",
    nodeEnv = String(environment.NODE_ENV || "development").toLowerCase(),
  } = {},
) {
  const raw = environment.POSTGRES_REPLICA_COUNT;
  const postgresProduction = nodeEnv === "production" && Boolean(databaseUrl);
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    if (postgresProduction) {
      const error = new TypeError("POSTGRES_REPLICA_COUNT jest wymagany dla PostgreSQL w production.");
      error.code = "POSTGRES_REPLICA_COUNT_REQUIRED";
      throw error;
    }
    return 1;
  }
  return parsePositiveInteger(raw, "POSTGRES_REPLICA_COUNT", MAX_POSTGRES_REPLICA_COUNT);
}

function connectionBudgetPlan({
  replicaCount,
  maxConnections,
  reservedConnections = 0,
  superuserReservedConnections = 0,
  operationalHeadroom = null,
  environment = process.env,
  profile = POSTGRES_RESOURCE_PROFILE,
} = {}) {
  const replicas = parsePositiveInteger(replicaCount, "POSTGRES_REPLICA_COUNT", MAX_POSTGRES_REPLICA_COUNT);
  const max = parsePositiveInteger(maxConnections, "max_connections", 1_000_000);
  const reserved = parseNonNegativeInteger(reservedConnections, "reserved_connections", max);
  const superuserReserved = parseNonNegativeInteger(superuserReservedConnections, "superuser_reserved_connections", max);
  const serverReservedConnections = reserved + superuserReserved;
  if (serverReservedConnections >= max) {
    throw new TypeError("Rezerwy PostgreSQL muszą pozostawić co najmniej jedno połączenie aplikacyjne.");
  }

  const configured = validateConfiguredPoolBudget(environment, profile);
  const poolMaxPerReplica = aggregatePoolMax(profile);
  const embeddedPersistentListenersPerReplica = aggregateEmbeddedPersistentListeners(profile);
  const externalDedicatedPerReplica = aggregateExternalPersistentClients(profile);
  const startupOverlapPerReplica = aggregateStartupTemporaryClients(profile);
  const clusterGlobalConnections = aggregateClusterGlobalClients(profile);
  const minimumOperationalHeadroom = Math.max(10, Math.ceil(max * 0.10));
  const configuredHeadroom = operationalHeadroom === null || operationalHeadroom === undefined
    ? minimumOperationalHeadroom
    : parseNonNegativeInteger(operationalHeadroom, "POSTGRES_OPERATIONAL_HEADROOM", max);
  const headroom = Math.max(minimumOperationalHeadroom, configuredHeadroom);

  const steadyEnvelope = replicas * (poolMaxPerReplica + externalDedicatedPerReplica) + clusterGlobalConnections;
  const startupEnvelope = replicas * (poolMaxPerReplica + externalDedicatedPerReplica + startupOverlapPerReplica) + clusterGlobalConnections;
  const safeApplicationCapacity = max - serverReservedConnections - headroom;
  const steadySafe = steadyEnvelope <= safeApplicationCapacity;
  const startupSafe = startupEnvelope <= safeApplicationCapacity;

  return Object.freeze({
    replicaCount: replicas,
    maxConnections: max,
    reservedConnections: reserved,
    superuserReservedConnections: superuserReserved,
    serverReservedConnections,
    operationalHeadroom: headroom,
    configuredPoolBudgetPerReplica: configured.budget,
    requestedPoolBudgetPerReplica: configured.requestedBudget,
    poolMaxPerReplica,
    embeddedPersistentListenersPerReplica,
    externalDedicatedPerReplica,
    startupOverlapPerReplica,
    clusterGlobalConnections,
    steadyEnvelope,
    startupEnvelope,
    safeApplicationCapacity,
    steadySafe,
    startupSafe,
    safe: steadySafe && startupSafe,
    formula: Object.freeze({
      steady: `${steadyEnvelope} <= ${safeApplicationCapacity}`,
      startup: `${startupEnvelope} <= ${safeApplicationCapacity}`,
      capacity: `${max} - ${reserved} reserved - ${superuserReserved} superuser_reserved - ${headroom} operational = ${safeApplicationCapacity}`,
    }),
  });
}

function clusterBudgetError(plan) {
  const error = new TypeError(
    `Niebezpieczna topologia PostgreSQL: steady=${plan.steadyEnvelope}, startup=${plan.startupEnvelope}, safeCapacity=${plan.safeApplicationCapacity}, replicas=${plan.replicaCount}.`,
  );
  error.code = "POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED";
  error.plan = plan;
  return error;
}

function validateClusterConnectionBudget(input = {}) {
  const plan = connectionBudgetPlan(input);
  if (!plan.safe) throw clusterBudgetError(plan);
  return plan;
}

const DEFAULT_POSTGRES_POOL_BUDGET = aggregatePoolMax(POSTGRES_RESOURCE_PROFILE);

function validateStartupClusterConnectionBudget({
  environment = process.env,
  capacity,
  profile = POSTGRES_RESOURCE_PROFILE,
} = {}) {
  if (!capacity || typeof capacity !== "object") {
    const error = new TypeError("Brak kompletnego odczytu pojemności PostgreSQL.");
    error.code = "POSTGRES_CAPACITY_SNAPSHOT_INCOMPLETE";
    throw error;
  }
  const replicaCount = resolvePostgresReplicaCount(environment);
  const operationalHeadroom = environment.POSTGRES_OPERATIONAL_HEADROOM === undefined
    ? null
    : environment.POSTGRES_OPERATIONAL_HEADROOM;
  return validateClusterConnectionBudget({
    replicaCount,
    maxConnections: capacity.maxConnections,
    reservedConnections: capacity.reservedConnections,
    superuserReservedConnections: capacity.superuserReservedConnections,
    operationalHeadroom,
    environment,
    profile,
  });
}

module.exports = Object.freeze({
  DEFAULT_POSTGRES_POOL_MAX,
  DEFAULT_POSTGRES_POOL_BUDGET,
  MAX_POSTGRES_REPLICA_COUNT,
  POSTGRES_RESOURCE_PROFILE,
  POSTGRES_POOL_PROFILE,
  aggregatePoolMax,
  aggregateEmbeddedPersistentListeners,
  aggregateExternalPersistentClients,
  aggregateStartupTemporaryClients,
  aggregateClusterGlobalClients,
  requestedPoolBudget,
  configuredPoolBudget,
  validateConfiguredPoolBudget,
  resolvePostgresReplicaCount,
  connectionBudgetPlan,
  validateClusterConnectionBudget,
  validateStartupClusterConnectionBudget,
});
