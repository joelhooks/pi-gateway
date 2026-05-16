import { describe, expect, test } from "vitest";
import { TelegramRelay } from "../src/relay/telegram-relay.js";

describe("TelegramRelay", () => {
  test("reports degraded when delivering before start", async () => {
    const relay = new TelegramRelay({ token: "fake", chatId: "fake" });
    const delivery = await relay.deliver({ projectId: "p", messageId: "m", title: "T", severity: "warn", channel: "default" });
    expect(delivery).toMatchObject({ relayId: "telegram", delivered: false, error: "relay is not running" });
    expect(await relay.health()).toMatchObject({ id: "telegram", status: "degraded" });
  });
});
