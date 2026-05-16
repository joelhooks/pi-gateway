export type RelayHealth = {
    id: string;
    status: "stopped" | "running" | "degraded";
    lastError?: string;
};
export type RelayDelivery = {
    relayId: string;
    delivered: boolean;
    receipt?: string;
    error?: string;
};
export type RelayEvent = {
    projectId: string;
    messageId: string;
    title: string;
    body?: string;
    severity: "info" | "warn" | "error";
    channel: string;
};
export interface GatewayRelay {
    readonly id: string;
    start(): Promise<RelayHealth>;
    stop(): Promise<RelayHealth>;
    health(): Promise<RelayHealth>;
    deliver(event: RelayEvent): Promise<RelayDelivery>;
}
export declare class FakeRelay implements GatewayRelay {
    readonly id: string;
    readonly deliveries: RelayEvent[];
    private current;
    constructor(id?: string);
    start(): Promise<RelayHealth>;
    stop(): Promise<RelayHealth>;
    health(): Promise<RelayHealth>;
    deliver(event: RelayEvent): Promise<{
        relayId: string;
        delivered: boolean;
        error: string | undefined;
        receipt?: undefined;
    } | {
        relayId: string;
        delivered: boolean;
        receipt: string;
        error?: undefined;
    }>;
}
