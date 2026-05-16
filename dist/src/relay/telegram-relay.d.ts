import type { GatewayRelay, RelayDelivery, RelayEvent, RelayHealth } from "./types.js";
export type TelegramRelayOptions = {
    id?: string;
    token: string;
    chatId: string;
};
export declare class TelegramRelay implements GatewayRelay {
    private readonly options;
    readonly id: string;
    private current;
    constructor(options: TelegramRelayOptions);
    start(): Promise<RelayHealth>;
    stop(): Promise<RelayHealth>;
    health(): Promise<RelayHealth>;
    deliver(event: RelayEvent): Promise<RelayDelivery>;
}
