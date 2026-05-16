import { type ActorRefFrom, type SnapshotFrom } from "xstate";
import { Effect } from "effect";
import type { GatewayMessage } from "./schema.js";
import { gatewayMachine } from "./machine.js";
import { type GatewayHomeConfig } from "./relay/config.js";
import type { GatewayRelay, RelayHealth } from "./relay/types.js";
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
export declare class SystemGatewayDaemon {
    readonly home: string;
    readonly indexPath: string;
    readonly actor: ActorRefFrom<typeof gatewayMachine>;
    private config;
    private index;
    private relays;
    constructor(options?: SystemGatewayOptions);
    static fromHome(home?: string): SystemGatewayDaemon;
    registerRelay(relay: GatewayRelay): GatewayRelay;
    start: () => Effect.Effect<SystemGatewayHealth, never, never>;
    stop: () => Effect.Effect<SystemGatewayHealth, never, never>;
    reloadConfig: () => Effect.Effect<RegisteredProject[], never, never>;
    listProjects: () => Effect.Effect<RegisteredProject[], never, never>;
    rebuildIndex: () => Effect.Effect<GatewayIndex, import("effect/ParseResult").ParseError, never>;
    listIndexedMessages: (options?: {
        projectId?: string;
        channel?: string;
        limit?: number;
    } | undefined) => Effect.Effect<GatewayIndexEntry[], never, never>;
    routeOperatorMessage: (input: {
        project: string;
        channel?: string;
        title: string;
        body?: string;
        from?: string;
    }) => Effect.Effect<{
        projectId: string;
        message: GatewayMessage;
    }, import("effect/ParseResult").ParseError, never>;
    claimProjectMessage: (input: {
        project: string;
        messageId: string;
        claimant?: string;
    }) => Effect.Effect<GatewayMessage | undefined, import("effect/ParseResult").ParseError, never>;
    deliverIndexedNotifications: () => Effect.Effect<import("./relay/types.js").RelayDelivery[], import("effect/ParseResult").ParseError, never>;
    discoverProjectSuggestions: (roots: string[]) => Effect.Effect<DiscoverySuggestion[], never, never>;
    health: () => Effect.Effect<SystemGatewayHealth, never, never>;
    snapshot(): SnapshotFrom<typeof gatewayMachine>;
    private projectsUnsafe;
    private resolveProjectUnsafe;
    private healthUnsafeAsync;
}
