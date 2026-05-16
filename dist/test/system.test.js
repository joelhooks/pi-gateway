import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { GatewayStore } from "../src/store.js";
import { SystemGatewayDaemon } from "../src/system.js";
function tempRoot(prefix) {
    return mkdtempSync(path.join(tmpdir(), prefix));
}
describe("SystemGatewayDaemon", () => {
    test("starts, reports health, and stops", async () => {
        const home = tempRoot("pi-gateway-system-home-");
        try {
            const daemon = new SystemGatewayDaemon({ home, config: { projects: [] } });
            const running = await Effect.runPromise(daemon.start());
            expect(running.status).toBe("running");
            expect(running.tags).toContain("healthy");
            const stopped = await Effect.runPromise(daemon.stop());
            expect(stopped.status).toBe("stopped");
        }
        finally {
            rmSync(home, { recursive: true, force: true });
        }
    });
    test("routes only to registered Project Gateways", async () => {
        const home = tempRoot("pi-gateway-system-home-");
        const projectRoot = tempRoot("pi-gateway-project-");
        try {
            const daemon = new SystemGatewayDaemon({
                home,
                config: { defaultProjectId: "aihero", projects: [{ id: "aihero", root: projectRoot, aliases: ["ai-hero"] }] },
            });
            await Effect.runPromise(daemon.start());
            const routed = await Effect.runPromise(daemon.routeOperatorMessage({ project: "ai-hero", title: "Ship it", body: "from ShitRat" }));
            expect(routed.projectId).toBe("aihero");
            expect(routed.message.metadata).toMatchObject({ routedBy: "system-gateway", operatorMessage: true });
            const messages = await Effect.runPromise(GatewayStore.fromRoot(projectRoot).listMessages());
            expect(messages).toHaveLength(1);
            expect(messages[0].title).toBe("Ship it");
            await expect(Effect.runPromise(daemon.routeOperatorMessage({ project: "unknown", title: "nope" }))).rejects.toThrow(/not registered/);
            await Effect.runPromise(daemon.stop());
        }
        finally {
            rmSync(home, { recursive: true, force: true });
            rmSync(projectRoot, { recursive: true, force: true });
        }
    });
    test("rebuilds a Gateway Index from registered Project Gateways", async () => {
        const home = tempRoot("pi-gateway-system-home-");
        const first = tempRoot("pi-gateway-project-a-");
        const second = tempRoot("pi-gateway-project-b-");
        try {
            await Effect.runPromise(GatewayStore.fromRoot(first).publish({ from: "test", title: "First" }));
            await Effect.runPromise(GatewayStore.fromRoot(second).publish({ from: "test", title: "Second" }));
            const daemon = new SystemGatewayDaemon({
                home,
                config: { projects: [{ id: "first", root: first }, { id: "second", root: second }] },
            });
            await Effect.runPromise(daemon.start());
            const index = await Effect.runPromise(daemon.rebuildIndex());
            expect(index.entries.map((entry) => [entry.projectId, entry.message.title])).toEqual(expect.arrayContaining([["first", "First"], ["second", "Second"]]));
            const listed = await Effect.runPromise(daemon.listIndexedMessages({ projectId: "second" }));
            expect(listed).toHaveLength(1);
            expect(listed[0].message.title).toBe("Second");
            await Effect.runPromise(daemon.stop());
        }
        finally {
            rmSync(home, { recursive: true, force: true });
            rmSync(first, { recursive: true, force: true });
            rmSync(second, { recursive: true, force: true });
        }
    });
    test("claims messages through the source Project Gateway", async () => {
        const home = tempRoot("pi-gateway-system-home-");
        const projectRoot = tempRoot("pi-gateway-project-");
        try {
            const message = await Effect.runPromise(GatewayStore.fromRoot(projectRoot).publish({ from: "agent", title: "Needs eyes" }));
            const daemon = new SystemGatewayDaemon({ home, config: { projects: [{ id: "support", root: projectRoot }] } });
            await Effect.runPromise(daemon.start());
            const claimed = await Effect.runPromise(daemon.claimProjectMessage({ project: "support", messageId: message.id }));
            expect(claimed?.status).toBe("claimed");
            expect(claimed?.claimedBy).toBe("system-gateway:ShitRat");
            const sourceMessages = await Effect.runPromise(GatewayStore.fromRoot(projectRoot).listMessages());
            expect(sourceMessages[0].status).toBe("claimed");
            expect(sourceMessages[0].receipts.some((receipt) => receipt.event === "claimed")).toBe(true);
            await Effect.runPromise(daemon.stop());
        }
        finally {
            rmSync(home, { recursive: true, force: true });
            rmSync(projectRoot, { recursive: true, force: true });
        }
    });
});
