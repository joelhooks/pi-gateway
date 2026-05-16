import { Effect } from "effect";
import { sendTelegramMessage } from "../telegram.js";
import type { GatewayRelay, RelayDelivery, RelayEvent, RelayHealth } from "./types.js";

export type TelegramRelayOptions = {
  id?: string;
  token: string;
  chatId: string;
};

export class TelegramRelay implements GatewayRelay {
  readonly id: string;
  private current: RelayHealth;

  constructor(private readonly options: TelegramRelayOptions) {
    this.id = options.id ?? "telegram";
    this.current = { id: this.id, status: "stopped" };
  }

  async start() {
    this.current = { id: this.id, status: "running" };
    return this.current;
  }

  async stop() {
    this.current = { id: this.id, status: "stopped" };
    return this.current;
  }

  async health() {
    return this.current;
  }

  async deliver(event: RelayEvent): Promise<RelayDelivery> {
    if (this.current.status !== "running") {
      this.current = { id: this.id, status: "degraded", lastError: "relay is not running" };
      return { relayId: this.id, delivered: false, error: this.current.lastError };
    }

    const text = [`[${event.projectId}] ${event.severity} ${event.channel}: ${event.title}`, event.body].filter(Boolean).join("\n");
    try {
      await Effect.runPromise(sendTelegramMessage({ token: this.options.token, chatId: this.options.chatId, text }));
      return { relayId: this.id, delivered: true, receipt: `${this.id}:${event.projectId}:${event.messageId}` };
    } catch (error) {
      this.current = { id: this.id, status: "degraded", lastError: error instanceof Error ? error.message : String(error) };
      return { relayId: this.id, delivered: false, error: this.current.lastError };
    }
  }
}
