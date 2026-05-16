import { Effect } from "effect";
import { GatewayAgentHeartbeat, GatewayConfig, GatewayMessage, GatewayState, type GatewaySeverity } from "./schema.js";
export declare function nowIso(now?: Date): string;
export declare function gatewayId(prefix: string, now?: number): string;
export type GatewayPaths = {
    root: string;
    dir: string;
    configPath: string;
    statePath: string;
};
export declare function gatewayPaths(root: string): GatewayPaths;
export declare class GatewayStore {
    readonly paths: GatewayPaths;
    constructor(paths: GatewayPaths);
    static fromRoot(root: string): GatewayStore;
    ensure: () => Effect.Effect<void, never, never>;
    readConfig: () => Effect.Effect<GatewayConfig, import("effect/ParseResult").ParseError, never>;
    readState: () => Effect.Effect<GatewayState, import("effect/ParseResult").ParseError, never>;
    saveState: (state: GatewayState) => Effect.Effect<GatewayState, never, never>;
    publish: (input: {
        channel?: string;
        from: string;
        to?: string;
        title: string;
        body?: string;
        severity?: GatewaySeverity;
        metadata?: Record<string, unknown>;
    }) => Effect.Effect<GatewayMessage, import("effect/ParseResult").ParseError, never>;
    listMessages: (options?: {
        channel?: string;
        status?: string;
        limit?: number;
    } | undefined) => Effect.Effect<GatewayMessage[], import("effect/ParseResult").ParseError, never>;
    claim: (id: string, claimant: string) => Effect.Effect<GatewayMessage | undefined, import("effect/ParseResult").ParseError, never>;
    heartbeat: (input: {
        id: string;
        name: string;
        cwd?: string;
        sessionId?: string;
        status?: string;
    }) => Effect.Effect<GatewayAgentHeartbeat | undefined, import("effect/ParseResult").ParseError, never>;
    addReceipt: (id: string, event: string, note?: string | undefined) => Effect.Effect<GatewayMessage | undefined, import("effect/ParseResult").ParseError, never>;
}
