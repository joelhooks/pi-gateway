import { Schema } from "effect";
export declare const GatewaySeverity: Schema.Literal<["info", "warn", "error"]>;
export type GatewaySeverity = typeof GatewaySeverity.Type;
export declare const GatewayMessageStatus: Schema.Literal<["new", "seen", "claimed", "resolved", "expired"]>;
export type GatewayMessageStatus = typeof GatewayMessageStatus.Type;
export declare const GatewayChannelKind: Schema.Literal<["local", "telegram"]>;
export type GatewayChannelKind = typeof GatewayChannelKind.Type;
declare const GatewayChannel_base: Schema.Class<GatewayChannel, {
    id: typeof Schema.String;
    kind: Schema.Literal<["local", "telegram"]>;
    enabled: typeof Schema.Boolean;
    chatId: Schema.optional<typeof Schema.String>;
    minSeverity: Schema.optional<Schema.Literal<["info", "warn", "error"]>>;
    routePattern: Schema.optional<typeof Schema.String>;
}, Schema.Struct.Encoded<{
    id: typeof Schema.String;
    kind: Schema.Literal<["local", "telegram"]>;
    enabled: typeof Schema.Boolean;
    chatId: Schema.optional<typeof Schema.String>;
    minSeverity: Schema.optional<Schema.Literal<["info", "warn", "error"]>>;
    routePattern: Schema.optional<typeof Schema.String>;
}>, never, {
    readonly id: string;
} & {
    readonly kind: "local" | "telegram";
} & {
    readonly enabled: boolean;
} & {
    readonly chatId?: string | undefined;
} & {
    readonly minSeverity?: "info" | "warn" | "error" | undefined;
} & {
    readonly routePattern?: string | undefined;
}, {}, {}>;
export declare class GatewayChannel extends GatewayChannel_base {
}
declare const GatewayConfig_base: Schema.Class<GatewayConfig, {
    schemaVersion: Schema.Literal<[1]>;
    channels: Schema.Array$<typeof GatewayChannel>;
    relay: Schema.optional<Schema.Struct<{
        pollIntervalMs: Schema.optional<typeof Schema.Number>;
        importantPattern: Schema.optional<typeof Schema.String>;
    }>>;
}, Schema.Struct.Encoded<{
    schemaVersion: Schema.Literal<[1]>;
    channels: Schema.Array$<typeof GatewayChannel>;
    relay: Schema.optional<Schema.Struct<{
        pollIntervalMs: Schema.optional<typeof Schema.Number>;
        importantPattern: Schema.optional<typeof Schema.String>;
    }>>;
}>, never, {
    readonly schemaVersion: 1;
} & {
    readonly channels: readonly GatewayChannel[];
} & {
    readonly relay?: {
        readonly pollIntervalMs?: number | undefined;
        readonly importantPattern?: string | undefined;
    } | undefined;
}, {}, {}>;
export declare class GatewayConfig extends GatewayConfig_base {
}
declare const GatewayReceipt_base: Schema.Class<GatewayReceipt, {
    at: typeof Schema.String;
    event: typeof Schema.String;
    note: Schema.optional<typeof Schema.String>;
}, Schema.Struct.Encoded<{
    at: typeof Schema.String;
    event: typeof Schema.String;
    note: Schema.optional<typeof Schema.String>;
}>, never, {
    readonly at: string;
} & {
    readonly event: string;
} & {
    readonly note?: string | undefined;
}, {}, {}>;
export declare class GatewayReceipt extends GatewayReceipt_base {
}
declare const GatewayMessage_base: Schema.Class<GatewayMessage, {
    id: typeof Schema.String;
    channel: typeof Schema.String;
    from: typeof Schema.String;
    to: Schema.optional<typeof Schema.String>;
    title: typeof Schema.String;
    body: Schema.optional<typeof Schema.String>;
    severity: Schema.Literal<["info", "warn", "error"]>;
    status: Schema.Literal<["new", "seen", "claimed", "resolved", "expired"]>;
    createdAt: typeof Schema.String;
    updatedAt: typeof Schema.String;
    claimedBy: Schema.optional<typeof Schema.String>;
    claimedAt: Schema.optional<typeof Schema.String>;
    metadata: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.Unknown>>;
    receipts: Schema.Array$<typeof GatewayReceipt>;
}, Schema.Struct.Encoded<{
    id: typeof Schema.String;
    channel: typeof Schema.String;
    from: typeof Schema.String;
    to: Schema.optional<typeof Schema.String>;
    title: typeof Schema.String;
    body: Schema.optional<typeof Schema.String>;
    severity: Schema.Literal<["info", "warn", "error"]>;
    status: Schema.Literal<["new", "seen", "claimed", "resolved", "expired"]>;
    createdAt: typeof Schema.String;
    updatedAt: typeof Schema.String;
    claimedBy: Schema.optional<typeof Schema.String>;
    claimedAt: Schema.optional<typeof Schema.String>;
    metadata: Schema.optional<Schema.Record$<typeof Schema.String, typeof Schema.Unknown>>;
    receipts: Schema.Array$<typeof GatewayReceipt>;
}>, never, {
    readonly id: string;
} & {
    readonly channel: string;
} & {
    readonly from: string;
} & {
    readonly title: string;
} & {
    readonly severity: "info" | "warn" | "error";
} & {
    readonly status: "new" | "seen" | "claimed" | "resolved" | "expired";
} & {
    readonly createdAt: string;
} & {
    readonly updatedAt: string;
} & {
    readonly to?: string | undefined;
} & {
    readonly body?: string | undefined;
} & {
    readonly claimedBy?: string | undefined;
} & {
    readonly claimedAt?: string | undefined;
} & {
    readonly metadata?: {
        readonly [x: string]: unknown;
    } | undefined;
} & {
    readonly receipts: readonly GatewayReceipt[];
}, {}, {}>;
export declare class GatewayMessage extends GatewayMessage_base {
}
declare const GatewayAgentHeartbeat_base: Schema.Class<GatewayAgentHeartbeat, {
    id: typeof Schema.String;
    name: typeof Schema.String;
    cwd: Schema.optional<typeof Schema.String>;
    sessionId: Schema.optional<typeof Schema.String>;
    status: Schema.optional<typeof Schema.String>;
    lastSeenAt: typeof Schema.String;
}, Schema.Struct.Encoded<{
    id: typeof Schema.String;
    name: typeof Schema.String;
    cwd: Schema.optional<typeof Schema.String>;
    sessionId: Schema.optional<typeof Schema.String>;
    status: Schema.optional<typeof Schema.String>;
    lastSeenAt: typeof Schema.String;
}>, never, {
    readonly id: string;
} & {
    readonly status?: string | undefined;
} & {
    readonly name: string;
} & {
    readonly lastSeenAt: string;
} & {
    readonly cwd?: string | undefined;
} & {
    readonly sessionId?: string | undefined;
}, {}, {}>;
export declare class GatewayAgentHeartbeat extends GatewayAgentHeartbeat_base {
}
declare const GatewayState_base: Schema.Class<GatewayState, {
    schemaVersion: Schema.Literal<[1]>;
    updatedAt: typeof Schema.String;
    messages: Schema.Array$<typeof GatewayMessage>;
    agents: Schema.Array$<typeof GatewayAgentHeartbeat>;
}, Schema.Struct.Encoded<{
    schemaVersion: Schema.Literal<[1]>;
    updatedAt: typeof Schema.String;
    messages: Schema.Array$<typeof GatewayMessage>;
    agents: Schema.Array$<typeof GatewayAgentHeartbeat>;
}>, never, {
    readonly schemaVersion: 1;
} & {
    readonly updatedAt: string;
} & {
    readonly messages: readonly GatewayMessage[];
} & {
    readonly agents: readonly GatewayAgentHeartbeat[];
}, {}, {}>;
export declare class GatewayState extends GatewayState_base {
}
export {};
