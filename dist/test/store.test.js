import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { GatewayStore } from "../src/store.js";
function tempRoot() {
    return mkdtempSync(path.join(tmpdir(), "pi-gateway-"));
}
describe("GatewayStore", () => {
    test("publishes, lists, and claims messages", async () => {
        const root = tempRoot();
        try {
            const store = GatewayStore.fromRoot(root);
            const message = await Effect.runPromise(store.publish({ from: "test", title: "hello", severity: "warn" }));
            expect(message.status).toBe("new");
            const listed = await Effect.runPromise(store.listMessages({ status: "new" }));
            expect(listed.map((item) => item.id)).toEqual([message.id]);
            const claimed = await Effect.runPromise(store.claim(message.id, "worker"));
            expect(claimed?.status).toBe("claimed");
            expect(claimed?.claimedBy).toBe("worker");
        }
        finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
