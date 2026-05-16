import { Effect } from "effect";
import type { GatewayChannel, GatewayMessage } from "./schema.js";
export declare function shouldRelayToTelegram(message: GatewayMessage, channel: GatewayChannel): boolean;
export declare function formatTelegramMessage(message: GatewayMessage): string;
export declare function sendTelegramMessage(input: {
    token: string;
    chatId: string;
    text: string;
}): Effect.Effect<unknown, Error, never>;
