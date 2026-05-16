import { Effect } from "effect";
import type { GatewayChannel, GatewayMessage } from "./schema.js";

export function shouldRelayToTelegram(message: GatewayMessage, channel: GatewayChannel) {
  if (!channel.enabled || channel.kind !== "telegram" || !channel.chatId) return false;
  if (channel.routePattern && !new RegExp(channel.routePattern, "i").test(`${message.channel} ${message.title} ${message.body ?? ""}`)) return false;
  const min = channel.minSeverity ?? "warn";
  const rank = { info: 0, warn: 1, error: 2 } as const;
  return rank[message.severity] >= rank[min];
}

export function formatTelegramMessage(message: GatewayMessage) {
  return [
    `🐀 pi-gateway ${message.severity}: ${message.title}`,
    message.body,
    `channel: ${message.channel}`,
    `id: ${message.id}`,
  ].filter(Boolean).join("\n\n");
}

export function sendTelegramMessage(input: { token: string; chatId: string; text: string }) {
  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(`https://api.telegram.org/bot${input.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: input.chatId, text: input.text.slice(0, 3900) }),
      });
      if (!response.ok) throw new Error(`Telegram send failed: ${response.status} ${await response.text()}`);
      return response.json() as Promise<unknown>;
    },
    catch: (error) => error instanceof Error ? error : new Error(String(error)),
  });
}
