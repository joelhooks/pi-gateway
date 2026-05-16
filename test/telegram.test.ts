import { describe, expect, test } from "vitest";
import { GatewayChannel, GatewayMessage, GatewayReceipt } from "../src/schema.js";
import { shouldRelayToTelegram } from "../src/telegram.js";

describe("telegram relay routing", () => {
  test("relays only configured telegram channels at or above severity", () => {
    const at = new Date().toISOString();
    const channel = new GatewayChannel({ id: "ops", kind: "telegram", enabled: true, chatId: "123", minSeverity: "warn" });
    const info = new GatewayMessage({
      id: "msg_info",
      channel: "default",
      from: "test",
      title: "FYI",
      severity: "info",
      status: "new",
      createdAt: at,
      updatedAt: at,
      receipts: [new GatewayReceipt({ at, event: "published" })],
    });
    const warn = new GatewayMessage({ ...info, id: "msg_warn", title: "Blocked", severity: "warn" });

    expect(shouldRelayToTelegram(info, channel)).toBe(false);
    expect(shouldRelayToTelegram(warn, channel)).toBe(true);
  });
});
