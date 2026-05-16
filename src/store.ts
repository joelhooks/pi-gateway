import { Effect, Schema } from "effect";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { GatewayAgentHeartbeat, GatewayChannel, GatewayConfig, GatewayMessage, GatewayReceipt, GatewayState, type GatewaySeverity } from "./schema.js";

export function nowIso(now = new Date()) {
  return now.toISOString();
}

export function gatewayId(prefix: string, now = Date.now()) {
  return `${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type GatewayPaths = {
  root: string;
  dir: string;
  configPath: string;
  statePath: string;
};

export function gatewayPaths(root: string): GatewayPaths {
  const dir = path.join(root, ".pi", "gateway");
  return {
    root,
    dir,
    configPath: path.join(dir, "config.json"),
    statePath: path.join(dir, "state.json"),
  };
}

const defaultConfig = new GatewayConfig({
  schemaVersion: 1,
  channels: [new GatewayChannel({ id: "default", kind: "local", enabled: true })],
});

const defaultState = () => new GatewayState({
  schemaVersion: 1,
  updatedAt: nowIso(),
  messages: [],
  agents: [],
});

function writeJsonAtomic(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, file);
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

export class GatewayStore {
  constructor(readonly paths: GatewayPaths) {}

  static fromRoot(root: string) {
    return new GatewayStore(gatewayPaths(root));
  }

  ensure = Effect.fn("GatewayStore.ensure")(function* (this: GatewayStore) {
    mkdirSync(this.paths.dir, { recursive: true });
    if (!existsSync(this.paths.configPath)) writeJsonAtomic(this.paths.configPath, defaultConfig);
    if (!existsSync(this.paths.statePath)) writeJsonAtomic(this.paths.statePath, defaultState());
  });

  readConfig = Effect.fn("GatewayStore.readConfig")(function* (this: GatewayStore) {
    yield* this.ensure();
    return yield* Schema.decodeUnknown(GatewayConfig)(readJson(this.paths.configPath));
  });

  readState = Effect.fn("GatewayStore.readState")(function* (this: GatewayStore) {
    yield* this.ensure();
    return yield* Schema.decodeUnknown(GatewayState)(readJson(this.paths.statePath));
  });

  saveState = Effect.fn("GatewayStore.saveState")(function* (this: GatewayStore, state: GatewayState) {
    writeJsonAtomic(this.paths.statePath, state);
    return state;
  });

  publish = Effect.fn("GatewayStore.publish")(function* (
    this: GatewayStore,
    input: {
      channel?: string;
      from: string;
      to?: string;
      title: string;
      body?: string;
      severity?: GatewaySeverity;
      metadata?: Record<string, unknown>;
    },
  ) {
    const state = yield* this.readState();
    const at = nowIso();
    const message = new GatewayMessage({
      id: gatewayId("msg"),
      channel: input.channel ?? "default",
      from: input.from,
      to: input.to,
      title: input.title,
      body: input.body,
      severity: input.severity ?? "info",
      status: "new",
      createdAt: at,
      updatedAt: at,
      metadata: input.metadata,
      receipts: [new GatewayReceipt({ at, event: "published" })],
    });
    const next = new GatewayState({ ...state, updatedAt: at, messages: [...state.messages, message] });
    yield* this.saveState(next);
    return message;
  });

  listMessages = Effect.fn("GatewayStore.listMessages")(function* (
    this: GatewayStore,
    options?: { channel?: string; status?: string; limit?: number },
  ) {
    const state = yield* this.readState();
    const filtered = state.messages
      .filter((message) => !options?.channel || message.channel === options.channel)
      .filter((message) => !options?.status || message.status === options.status)
      .slice(-(options?.limit ?? 20));
    return filtered;
  });

  claim = Effect.fn("GatewayStore.claim")(function* (this: GatewayStore, id: string, claimant: string) {
    const state = yield* this.readState();
    const at = nowIso();
    const messages = state.messages.map((message) => {
      if (message.id !== id || message.status !== "new") return message;
      return new GatewayMessage({
        ...message,
        status: "claimed",
        claimedBy: claimant,
        claimedAt: at,
        updatedAt: at,
        receipts: [...message.receipts, new GatewayReceipt({ at, event: "claimed", note: claimant })],
      });
    });
    const claimed = messages.find((message) => message.id === id && message.status === "claimed");
    if (claimed) yield* this.saveState(new GatewayState({ ...state, updatedAt: at, messages }));
    return claimed;
  });

  heartbeat = Effect.fn("GatewayStore.heartbeat")(function* (
    this: GatewayStore,
    input: { id: string; name: string; cwd?: string; sessionId?: string; status?: string },
  ) {
    const state = yield* this.readState();
    const at = nowIso();
    const existing = state.agents.filter((agent) => agent.id !== input.id);
    const agents = [...existing, new GatewayAgentHeartbeat({ ...input, lastSeenAt: at })];
    const next = new GatewayState({ ...state, updatedAt: at, agents });
    yield* this.saveState(next);
    return agents.at(-1);
  });

  addReceipt = Effect.fn("GatewayStore.addReceipt")(function* (this: GatewayStore, id: string, event: string, note?: string) {
    const state = yield* this.readState();
    const at = nowIso();
    const messages = state.messages.map((message) => {
      if (message.id !== id) return message;
      return new GatewayMessage({
        ...message,
        updatedAt: at,
        receipts: [...message.receipts, new GatewayReceipt({ at, event, note })],
      });
    });
    const updated = messages.find((message) => message.id === id);
    yield* this.saveState(new GatewayState({ ...state, updatedAt: at, messages }));
    return updated;
  });
}
