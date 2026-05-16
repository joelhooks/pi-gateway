import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createTelegramRouter } from "../src/relay/telegram-router.js";
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
                projects: [{ id: "aihero", root, aliases: ["ai-hero"] }],
            });
            const published = await router.handle("/aihero publish Smoke -- from telegram", "t1");
            expect(published).toMatch(/published msg_/);
            const listed = await router.handle("gateway list aihero", "t1");
            expect(listed).toContain("Smoke");
            expect(listed).toContain("from telegram");
            const slashStatus = await router.handle("/aihero", "t1");
            expect(slashStatus).toContain("aihero gateway");
            const naturalList = await router.handle("messages", "t1");
            expect(naturalList).toContain("Smoke");
        }
        finally {
            rmSync(root, { recursive: true, force: true });
            rmSync(stateRoot, { recursive: true, force: true });
        }
    });
});
