export type GatewaySeverity = "info" | "warn" | "error";
export type GatewayMessageStatus = "new" | "seen" | "claimed" | "resolved" | "expired";
export type GatewayChannelKind = "local" | "telegram";
export type GatewayChannel = {
    id: string;
    kind: GatewayChannelKind;
    enabled: boolean;
    chatId?: string;
    minSeverity?: GatewaySeverity;
    routePattern?: string;
};
export type GatewayConfig = {
    schemaVersion: 1;
    channels: GatewayChannel[];
    relay?: {
        pollIntervalMs?: number;
        importantPattern?: string;
    };
};
export type GatewayMessage = {
    id: string;
    channel: string;
    from: string;
    to?: string;
    title: string;
    body?: string;
    severity: GatewaySeverity;
    status: GatewayMessageStatus;
    createdAt: string;
    updatedAt: string;
    claimedBy?: string;
    claimedAt?: string;
    metadata?: Record<string, unknown>;
    receipts: Array<{
        at: string;
        event: string;
        note?: string;
    }>;
};
export type GatewayState = {
    schemaVersion: 1;
    updatedAt: string;
    messages: GatewayMessage[];
    agents: GatewayAgentHeartbeat[];
};
export type GatewayAgentHeartbeat = {
    id: string;
    name: string;
    cwd?: string;
    sessionId?: string;
    status?: string;
    lastSeenAt: string;
};
