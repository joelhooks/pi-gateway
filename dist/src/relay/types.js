export class FakeRelay {
    id;
    deliveries = [];
    current;
    constructor(id = "fake") {
        this.id = id;
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
    async deliver(event) {
        if (this.current.status !== "running") {
            this.current = { id: this.id, status: "degraded", lastError: "relay is not running" };
            return { relayId: this.id, delivered: false, error: this.current.lastError };
        }
        this.deliveries.push(event);
        return { relayId: this.id, delivered: true, receipt: `${this.id}:${event.projectId}:${event.messageId}` };
    }
}
