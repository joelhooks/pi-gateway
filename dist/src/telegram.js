import { Effect } from "effect";
export function shouldRelayToTelegram(message, channel) {
    if (!channel.enabled || channel.kind !== "telegram" || !channel.chatId)
        return false;
    if (channel.routePattern && !new RegExp(channel.routePattern, "i").test(`${message.channel} ${message.title} ${message.body ?? ""}`))
        return false;
    const min = channel.minSeverity ?? "warn";
    const rank = { info: 0, warn: 1, error: 2 };
    return rank[message.severity] >= rank[min];
}
export function formatTelegramMessage(message) {
    return [
        `🐀 pi-gateway ${message.severity}: ${message.title}`,
        message.body,
        `channel: ${message.channel}`,
        `id: ${message.id}`,
    ].filter(Boolean).join("\n\n");
}
export function sendTelegramMessage(input) {
    return Effect.tryPromise({
        try: async () => {
            const response = await fetch(`https://api.telegram.org/bot${input.token}/sendMessage`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ chat_id: input.chatId, text: input.text.slice(0, 3900) }),
            });
            if (!response.ok)
                throw new Error(`Telegram send failed: ${response.status} ${await response.text()}`);
            return response.json();
        },
        catch: (error) => error instanceof Error ? error : new Error(String(error)),
    });
}
