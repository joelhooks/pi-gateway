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

export class FakeRelay implements GatewayRelay {
  readonly deliveries: RelayEvent[] = [];
  private current: RelayHealth;

  constructor(readonly id = "fake") {
    this.current = { id, status: "stopped" };
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

  async deliver(event: RelayEvent) {
    if (this.current.status !== "running") {
      this.current = { id: this.id, status: "degraded", lastError: "relay is not running" };
      return { relayId: this.id, delivered: false, error: this.current.lastError };
    }
    this.deliveries.push(event);
    return { relayId: this.id, delivered: true, receipt: `${this.id}:${event.projectId}:${event.messageId}` };
  }
}
