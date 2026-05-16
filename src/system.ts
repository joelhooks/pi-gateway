import { createActor, type ActorRefFrom, type SnapshotFrom } from "xstate";
import { Effect } from "effect";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gatewayPaths, GatewayStore } from "./store.js";
import type { GatewayMessage } from "./schema.js";
import { gatewayMachine } from "./machine.js";
import { gatewayHome, readGatewayHomeConfig, type GatewayHomeConfig } from "./relay/config.js";
import type { GatewayRelay, RelayEvent, RelayHealth } from "./relay/types.js";

export type RegisteredProject = {
  id: string;
  root: string;
  aliases?: string[];
};

export type GatewayIndexEntry = {
  projectId: string;
  message: GatewayMessage;
};

export type GatewayIndex = {
  schemaVersion: 1;
  rebuiltAt: string;
  entries: GatewayIndexEntry[];
};

export type DiscoverySuggestion = {
  id: string;
  root: string;
  reason: string;
};

export type SystemGatewayHealth = {
  status: string;
  tags: string[];
  home: string;
  projects: number;
  indexedMessages: number;
  relays: RelayHealth[];
  lastError?: string;
};

export type SystemGatewayOptions = {
  home?: string;
  config?: GatewayHomeConfig;
  now?: () => Date;
};

function nowIso(now?: () => Date) {
  return (now?.() ?? new Date()).toISOString();
}

function writeJsonAtomic(file: string, value: unknown) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, file);
}

function readIndex(file: string): GatewayIndex | undefined {
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8")) as GatewayIndex;
}

export class SystemGatewayDaemon {
  readonly home: string;
  readonly indexPath: string;
  readonly actor: ActorRefFrom<typeof gatewayMachine>;
  private config: GatewayHomeConfig;
  private index: GatewayIndex;
  private relays: GatewayRelay[] = [];

  constructor(options: SystemGatewayOptions = {}) {
    this.home = options.home ?? gatewayHome();
    this.config = options.config ?? readGatewayHomeConfig(this.home);
    this.indexPath = join(this.home, "gateway-index.json");
    this.index = readIndex(this.indexPath) ?? { schemaVersion: 1, rebuiltAt: nowIso(options.now), entries: [] };
    this.actor = createActor(gatewayMachine, { input: { root: this.home } });
  }

  static fromHome(home = gatewayHome()) {
    return new SystemGatewayDaemon({ home });
  }

  registerRelay(relay: GatewayRelay) {
    this.relays.push(relay);
    return relay;
  }

  start = Effect.fn("SystemGatewayDaemon.start")(function* (this: SystemGatewayDaemon) {
    mkdirSync(this.home, { recursive: true });
    this.actor.start();
    this.actor.send({ type: "gateway.start" });
    for (const relay of this.relays) {
      yield* Effect.promise(() => relay.start());
    }
    return yield* this.health();
  });

  stop = Effect.fn("SystemGatewayDaemon.stop")(function* (this: SystemGatewayDaemon) {
    for (const relay of this.relays) {
      yield* Effect.promise(() => relay.stop());
    }
    this.actor.send({ type: "gateway.stop" });
    this.actor.stop();
    return yield* this.health();
  });

  reloadConfig = Effect.fn("SystemGatewayDaemon.reloadConfig")(function* (this: SystemGatewayDaemon) {
    this.config = readGatewayHomeConfig(this.home);
    return this.projectsUnsafe();
  });

  listProjects = Effect.fn("SystemGatewayDaemon.listProjects")(function* (this: SystemGatewayDaemon) {
    return this.projectsUnsafe();
  });

  rebuildIndex = Effect.fn("SystemGatewayDaemon.rebuildIndex")(function* (this: SystemGatewayDaemon) {
    const entries: GatewayIndexEntry[] = [];
    for (const project of this.projectsUnsafe()) {
      const messages = yield* GatewayStore.fromRoot(project.root).listMessages({ limit: 500 });
      entries.push(...messages.map((message) => ({ projectId: project.id, message })));
    }
    this.index = { schemaVersion: 1, rebuiltAt: nowIso(), entries };
    mkdirSync(dirname(this.indexPath), { recursive: true });
    writeFileSync(this.indexPath, `${JSON.stringify(this.index, null, 2)}\n`);
    return this.index;
  });

  listIndexedMessages = Effect.fn("SystemGatewayDaemon.listIndexedMessages")(function* (
    this: SystemGatewayDaemon,
    options?: { projectId?: string; channel?: string; limit?: number },
  ) {
    const entries = this.index.entries
      .filter((entry) => !options?.projectId || entry.projectId === options.projectId)
      .filter((entry) => !options?.channel || entry.message.channel === options.channel)
      .slice(-(options?.limit ?? 20));
    return entries;
  });

  routeOperatorMessage = Effect.fn("SystemGatewayDaemon.routeOperatorMessage")(function* (
    this: SystemGatewayDaemon,
    input: { project: string; channel?: string; title: string; body?: string; from?: string },
  ) {
    const project = this.resolveProjectUnsafe(input.project);
    if (!project) throw new Error(`Project is not registered: ${input.project}`);
    const message = yield* GatewayStore.fromRoot(project.root).publish({
      channel: input.channel,
      from: input.from ?? "system-gateway:ShitRat",
      title: input.title,
      body: input.body,
      metadata: { routedBy: "system-gateway", projectId: project.id, operatorMessage: true },
    });
    this.actor.send({ type: "message.published", message });
    return { projectId: project.id, message };
  });

  claimProjectMessage = Effect.fn("SystemGatewayDaemon.claimProjectMessage")(function* (
    this: SystemGatewayDaemon,
    input: { project: string; messageId: string; claimant?: string },
  ) {
    const project = this.resolveProjectUnsafe(input.project);
    if (!project) throw new Error(`Project is not registered: ${input.project}`);
    return yield* GatewayStore.fromRoot(project.root).claim(input.messageId, input.claimant ?? "system-gateway:ShitRat");
  });

  deliverIndexedNotifications = Effect.fn("SystemGatewayDaemon.deliverIndexedNotifications")(function* (this: SystemGatewayDaemon) {
    const deliveries = [];
    for (const entry of this.index.entries) {
      const event: RelayEvent = {
        projectId: entry.projectId,
        messageId: entry.message.id,
        title: entry.message.title,
        body: entry.message.body,
        severity: entry.message.severity,
        channel: entry.message.channel,
      };
      for (const relay of this.relays) {
        const delivery = yield* Effect.promise(() => relay.deliver(event));
        deliveries.push(delivery);
        if (delivery.delivered) {
          yield* GatewayStore.fromRoot(this.resolveProjectUnsafe(entry.projectId)?.root ?? "").addReceipt(entry.message.id, "relayed", delivery.receipt);
        }
      }
    }
    return deliveries;
  });

  discoverProjectSuggestions = Effect.fn("SystemGatewayDaemon.discoverProjectSuggestions")(function* (this: SystemGatewayDaemon, roots: string[]) {
    const registered = new Set(this.projectsUnsafe().map((project) => project.root));
    const suggestions: DiscoverySuggestion[] = [];
    for (const root of roots) {
      if (registered.has(root)) continue;
      if (!existsSync(gatewayPaths(root).configPath) && !existsSync(gatewayPaths(root).statePath)) continue;
      suggestions.push({ id: root.split("/").filter(Boolean).at(-1) ?? root, root, reason: "project gateway files found" });
    }
    return suggestions;
  });

  health = Effect.fn("SystemGatewayDaemon.health")(function* (this: SystemGatewayDaemon) {
    return yield* Effect.promise(async () => this.healthUnsafeAsync());
  });

  snapshot(): SnapshotFrom<typeof gatewayMachine> {
    return this.actor.getSnapshot();
  }

  private projectsUnsafe(): RegisteredProject[] {
    return (this.config.projects ?? []).map((project) => ({ id: project.id, root: project.root, aliases: project.aliases ?? [] }));
  }

  private resolveProjectUnsafe(input: string): RegisteredProject | undefined {
    const needle = input.toLowerCase();
    return this.projectsUnsafe().find((project) => project.id.toLowerCase() === needle || (project.aliases ?? []).some((alias) => alias.toLowerCase() === needle));
  }

  private async healthUnsafeAsync(): Promise<SystemGatewayHealth> {
    const snapshot = this.actor.getSnapshot();
    return {
      status: String(snapshot.value),
      tags: Array.from(snapshot.tags),
      home: this.home,
      projects: this.projectsUnsafe().length,
      indexedMessages: this.index.entries.length,
      relays: await Promise.all(this.relays.map((relay) => relay.health())),
      lastError: snapshot.context.lastError,
    };
  }
}
