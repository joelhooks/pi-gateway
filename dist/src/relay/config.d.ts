import type { TelegramRouterConfig } from "./telegram-router.js";
export type GatewayHomeConfig = {
    defaultProjectId?: string;
    stateFile?: string;
    telegram?: {
        userName?: string;
        notificationIntervalMs?: number;
        ownerChatId?: string;
    };
    projects?: Array<{
        id: string;
        root: string;
        aliases?: string[];
    }>;
};
export type GatewayCredentials = {
    telegram?: {
        botToken?: string;
    };
};
export declare function gatewayHome(): string;
export declare function readJsonFile<T>(path: string, fallback: T): T;
export declare function readGatewayHomeConfig(home?: string): GatewayHomeConfig;
export declare function readGatewayCredentials(home?: string): GatewayCredentials;
export declare function routerConfigFromHome(home?: string): TelegramRouterConfig;
export declare function telegramTokenFromHome(home?: string): string | undefined;
export declare function ownerChatIdFromHome(home?: string): string | undefined;
export declare function telegramUserNameFromHome(home?: string): string;
export declare function telegramNotificationIntervalMsFromHome(home?: string): number;
export declare function hasCredentialsFile(home?: string): boolean;
