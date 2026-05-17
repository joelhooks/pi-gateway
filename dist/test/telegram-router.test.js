import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { createTelegramRouter, TELEGRAM_ROUTED_SILENTLY } from "../src/relay/telegram-router.js";
import { GatewayStore } from "../src/store.js";
function tempRoot(prefix) {
    return mkdtempSync(path.join(tmpdir(), prefix));
}
describe("telegram router", () => {
    test("publishes and lists through project aliases", async () => {
        const root = tempRoot("pi-gateway-router-root-");
        const stateRoot = tempRoot("pi-gateway-router-state-");
        try {
            const router = createTelegramRouter({
                defaultProjectId: "aihero",
                stateFile: path.join(stateRoot, "router.json"),
                projects: [{ id: "aihero", root, aliases: ["ai-hero"], wakeCommand: false }],
            });
            const published = await router.handle("/aihero publish Smoke -- from telegram", "t1");
            expect(published).toMatch(/published msg_/);
            const listed = await router.handle("gateway list aihero", "t1");
            expect(listed).toContain("Smoke");
            expect(listed).toContain("from telegram");
            const slashStatus = await router.handle("/gateway", "t1");
            expect(slashStatus).toContain("aihero gateway");
            const naturalList = await router.handle("messages", "t1");
            expect(naturalList).toContain("Smoke");
        }
        finally {
            rmSync(root, { recursive: true, force: true });
            rmSync(stateRoot, { recursive: true, force: true });
        }
    });
    test("activates per-thread context and persists across router instances", async () => {
        const root = tempRoot("pi-gateway-router-root-");
        const stateRoot = tempRoot("pi-gateway-router-state-");
        const stateFile = path.join(stateRoot, "router.json");
        try {
            const router = createTelegramRouter({ defaultProjectId: "aihero", stateFile, projects: [{ id: "aihero", root, wakeCommand: false }] });
            const activated = await router.handle("/aihero", "thread-a");
            expect(activated).toContain("activated aihero context");
            const freshRouter = createTelegramRouter({ defaultProjectId: "aihero", stateFile, projects: [{ id: "aihero", root, wakeCommand: false }] });
            const where = await freshRouter.handle("where am i", "thread-a");
            expect(where).toContain("context: aihero");
            expect(where).toContain("attachment: none");
        }
        finally {
            rmSync(root, { recursive: true, force: true });
            rmSync(stateRoot, { recursive: true, force: true });
        }
    });
    test("unprefixed context messages attach to live agents", async () => {
        const root = tempRoot("pi-gateway-router-root-");
        const stateRoot = tempRoot("pi-gateway-router-state-");
        try {
            await Effect.runPromise(GatewayStore.fromRoot(root).heartbeat({ id: "agent-1", name: "AI Hero Agent", cwd: root, status: "running" }));
            const router = createTelegramRouter({ defaultProjectId: "aihero", stateFile: path.join(stateRoot, "router.json"), projects: [{ id: "aihero", root, wakeCommand: false }] });
            expect(await router.handle("/aihero", "thread-a")).toContain("attached to AI Hero Agent");
            const sent = await router.handle("please check the deploy", "thread-a");
            expect(sent).toBe(TELEGRAM_ROUTED_SILENTLY);
            const messages = await Effect.runPromise(GatewayStore.fromRoot(root).listMessages());
            expect(messages.at(-1)?.to).toBe("agent-1");
            expect(messages.at(-1)?.metadata).toMatchObject({ contextMode: true, attachedAgentId: "agent-1", agentWakeRequested: false });
        }
        finally {
            rmSync(root, { recursive: true, force: true });
            rmSync(stateRoot, { recursive: true, force: true });
        }
    });
    test("unprefixed context messages request Agent Wake when no live agent exists", async () => {
        const root = tempRoot("pi-gateway-router-root-");
        const stateRoot = tempRoot("pi-gateway-router-state-");
        try {
            const router = createTelegramRouter({ defaultProjectId: "aihero", stateFile: path.join(stateRoot, "router.json"), projects: [{ id: "aihero", root, wakeCommand: false }] });
            await router.handle("/aihero", "thread-a");
            const queued = await router.handle("wake up and inspect support", "thread-a");
            expect(queued).toBe(TELEGRAM_ROUTED_SILENTLY);
            const messages = await Effect.runPromise(GatewayStore.fromRoot(root).listMessages());
            expect(messages.at(-1)?.metadata).toMatchObject({ contextMode: true, projectId: "aihero", agentWakeRequested: true });
        }
        finally {
            rmSync(root, { recursive: true, force: true });
            rmSync(stateRoot, { recursive: true, force: true });
        }
    });
    test("detach clears attachment but preserves context", async () => {
        const root = tempRoot("pi-gateway-router-root-");
        const stateRoot = tempRoot("pi-gateway-router-state-");
        try {
            await Effect.runPromise(GatewayStore.fromRoot(root).heartbeat({ id: "agent-1", name: "AI Hero Agent", cwd: root, status: "running" }));
            const router = createTelegramRouter({ defaultProjectId: "aihero", stateFile: path.join(stateRoot, "router.json"), projects: [{ id: "aihero", root, wakeCommand: false }] });
            await router.handle("/aihero", "thread-a");
            expect(await router.handle("detach", "thread-a")).toContain("Context remains aihero");
            const where = await router.handle("where am i", "thread-a");
            expect(where).toContain("context: aihero");
            expect(where).toContain("attachment: none");
        }
        finally {
            rmSync(root, { recursive: true, force: true });
            rmSync(stateRoot, { recursive: true, force: true });
        }
    });
    test("does not relay replies from a stale project context", async () => {
        const aihero = tempRoot("pi-gateway-aihero-");
        const cascadia = tempRoot("pi-gateway-cascadia-");
        const stateRoot = tempRoot("pi-gateway-router-state-");
        const stateFile = path.join(stateRoot, "router.json");
        try {
            const router = createTelegramRouter({
                defaultProjectId: "aihero",
                stateFile,
                projects: [
                    { id: "aihero", root: aihero, wakeCommand: false },
                    { id: "cascadia", root: cascadia, wakeCommand: false },
                ],
            });
            await router.handle("/cascadia", "telegram:1");
            await Effect.runPromise(GatewayStore.fromRoot(aihero).publish({ from: "agent", to: "telegram:1", title: "stale", body: "wrong lane" }));
            await Effect.runPromise(GatewayStore.fromRoot(cascadia).publish({ from: "agent", to: "telegram:1", title: "fresh", body: "right lane" }));
            const posts = [];
            await router.pollNotifications({ post: async (message) => { posts.push(String(message)); } });
            expect(posts).toEqual(["right lane"]);
        }
        finally {
            rmSync(aihero, { recursive: true, force: true });
            rmSync(cascadia, { recursive: true, force: true });
            rmSync(stateRoot, { recursive: true, force: true });
        }
    });
});
