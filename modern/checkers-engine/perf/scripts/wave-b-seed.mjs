import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import pg from "pg";

import { AuthService } from "../../src/auth.js";
import { WAVE_B_GUEST_TTL_SECONDS } from "./wave-b-auth-policy.mjs";
import { createWaveBSeedPlatform } from "./wave-b-seed-platform.mjs";

const { Pool } = pg;
const secret = process.env.AUTH_SECRET;
if (!secret || Buffer.byteLength(secret) < 32) throw new Error("AUTH_SECRET >= 32 bytes is required.");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL required");

const baseUrls = String(process.env.BASE_URLS || "http://127.0.0.1:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const base = baseUrls[0];
const userCount = Math.max(100, Math.min(200000, Number(process.env.WAVE_B_USER_COUNT || 1600)));
const gameCount = Math.max(1, Math.min(10000, Number(process.env.WAVE_B_GAME_COUNT || 50)));
const runId = String(process.env.WAVE_B_RUN_ID || "waveb")
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(0, 32) || "waveb";
const output = resolve(process.env.WAVE_B_DATASET || "perf/k6/datasets/runtime.json");

const auth = new AuthService({ secret, ttlSeconds: WAVE_B_GUEST_TTL_SECONDS });
const users = Array.from({ length: userCount }, (_, index) => {
  const number = String(index + 1).padStart(6, "0");
  const userId = `wb${number}`;
  const displayName = `WB ${number}`;
  return {
    userId,
    displayName,
    token: auth.issueGuest({ userId, displayName, ttlSeconds: WAVE_B_GUEST_TTL_SECONDS }),
  };
});

let cursor = 0;
function take(count) {
  if (cursor + count > users.length) throw new Error(`Need more users: ${cursor}+${count}>${users.length}`);
  const result = users.slice(cursor, cursor + count);
  cursor += count;
  return result;
}

async function api(path) {
  const response = await fetch(`${base}${path}`, { headers: { accept: "application/json" } });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text.slice(0, 500) };
  }
  if (!response.ok) throw new Error(`GET ${path} => ${response.status} ${JSON.stringify(payload).slice(0, 800)}`);
  return payload;
}

await api("/health");

const seedPlatform = await createWaveBSeedPlatform(url);
const checkersGames = [];
const gomokuGames = [];
const thousandGames = [];

async function seedLobbyGame(gameType, playerCount) {
  const players = take(playerCount);
  const owner = players[0];
  const room = await seedPlatform.lobby.createRoom({
    ownerId: owner.userId,
    ownerName: owner.displayName,
    roomName: `${runId}-${gameType}-${cursor}`,
    gameType,
    maxPlayers: playerCount,
  });

  let current = room;
  for (const player of players.slice(1)) {
    current = await seedPlatform.lobby.joinRoom({
      roomId: room.roomId,
      playerId: player.userId,
      playerName: player.displayName,
    });
  }

  if (!current.gameId || current.status !== "playing") {
    throw new Error(`Seeded ${gameType} room did not become playing`);
  }
  return {
    gameId: current.gameId,
    roomId: current.roomId,
    players: players.map((player) => player.userId),
  };
}

try {
  for (let index = 0; index < gameCount; index += 1) checkersGames.push(await seedLobbyGame("checkers", 2));
  for (let index = 0; index < gameCount; index += 1) gomokuGames.push(await seedLobbyGame("gomoku", 2));
  for (let index = 0; index < gameCount; index += 1) thousandGames.push(await seedLobbyGame("thousand", 3));
} finally {
  await seedPlatform.close();
}

const pool = new Pool({ connectionString: url, max: 2 });
async function versions(table, column, games) {
  if (!games.length) return;
  const ids = games.map((game) => game.gameId);
  const { rows } = await pool.query(
    `SELECT game_id,${column} AS revision FROM ${table} WHERE game_id=ANY($1)`,
    [ids],
  );
  const map = new Map(rows.map((row) => [row.game_id, Number(row.revision)]));
  for (const game of games) game[column === "version" ? "initialVersion" : "initialRevision"] = map.get(game.gameId) ?? null;
}

try {
  await versions("gracz_game_sessions", "version", checkersGames);
  await versions("gracz_gomoku_games", "revision", gomokuGames);
  await versions("gracz_thousand_games", "revision", thousandGames);
} finally {
  await pool.end();
}

const structural = {
  runId,
  seed: process.env.WAVE_B_SEED || "20260909",
  users: users.map((user) => user.userId),
  checkersGames,
  gomokuGames,
  thousandGames,
};
const datasetId = createHash("sha256").update(JSON.stringify(structural)).digest("hex");
const data = {
  runId,
  datasetId,
  baseUrls,
  seed: structural.seed,
  generatedAt: new Date().toISOString(),
  users,
  checkersGames,
  gomokuGames,
  thousandGames,
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(data));
console.log(JSON.stringify({
  runId,
  output,
  datasetId,
  userCount: users.length,
  checkersGames: checkersGames.length,
  gomokuGames: gomokuGames.length,
  thousandGames: thousandGames.length,
  setupPath: "canonical-lobby-service",
}, null, 2));
