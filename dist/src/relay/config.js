import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
export function gatewayHome() {
    return process.env.PI_GATEWAY_HOME || join(process.env.HOME || process.cwd(), ".pi-gateway");
}
export function readJsonFile(path, fallback) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return fallback;
    }
}
export function readGatewayHomeConfig(home = gatewayHome()) {
    return readJsonFile(join(home, "config.json"), {});
}
export function readGatewayCredentials(home = gatewayHome()) {
    return readJsonFile(join(home, "credentials.json"), {});
}
export function routerConfigFromHome(home = gatewayHome()) {
    const config = readGatewayHomeConfig(home);
    const projects = config.projects?.length
        ? config.projects
        : [{ id: process.env.PI_GATEWAY_DEFAULT_PROJECT || "default", root: process.env.PI_GATEWAY_DEFAULT_ROOT || process.cwd(), aliases: [] }];
    return {
        defaultProjectId: config.defaultProjectId || process.env.PI_GATEWAY_DEFAULT_PROJECT || projects[0].id,
        stateFile: config.stateFile || join(home, "telegram-router-state.json"),
        projects,
    };
}
export function telegramTokenFromHome(home = gatewayHome()) {
    return process.env.PI_GATEWAY_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || readGatewayCredentials(home).telegram?.botToken;
}
export function ownerChatIdFromHome(home = gatewayHome()) {
    const config = readGatewayHomeConfig(home);
    return process.env.PI_GATEWAY_TELEGRAM_OWNER_CHAT_ID || config.telegram?.ownerChatId;
}
export function telegramUserNameFromHome(home = gatewayHome()) {
    const config = readGatewayHomeConfig(home);
    return process.env.PI_GATEWAY_TELEGRAM_USER_NAME || config.telegram?.userName || "pi-gateway";
}
export function telegramNotificationIntervalMsFromHome(home = gatewayHome()) {
    const config = readGatewayHomeConfig(home);
    return Number(process.env.PI_GATEWAY_TELEGRAM_NOTIFICATION_INTERVAL_MS || config.telegram?.notificationIntervalMs || 60_000);
}
export function hasCredentialsFile(home = gatewayHome()) {
    return existsSync(join(home, "credentials.json"));
}
