#!/usr/bin/env node
import { Effect } from "effect";
import { SystemGatewayDaemon } from "./system.js";
const command = process.argv[2] ?? "run";
const daemon = SystemGatewayDaemon.fromHome();
async function main() {
    if (command === "status") {
        await Effect.runPromise(daemon.start());
        console.log(JSON.stringify(await Effect.runPromise(daemon.health()), null, 2));
        await Effect.runPromise(daemon.stop());
        return;
    }
    if (command === "projects") {
        await Effect.runPromise(daemon.start());
        console.log(JSON.stringify(await Effect.runPromise(daemon.listProjects()), null, 2));
        await Effect.runPromise(daemon.stop());
        return;
    }
    if (command === "reindex") {
        await Effect.runPromise(daemon.start());
        console.log(JSON.stringify(await Effect.runPromise(daemon.rebuildIndex()), null, 2));
        await Effect.runPromise(daemon.stop());
        return;
    }
    if (command === "route") {
        const [project, title, ...bodyParts] = process.argv.slice(3);
        if (!project || !title)
            throw new Error("usage: pi-gateway-daemon route <project> <title> [body]");
        await Effect.runPromise(daemon.start());
        console.log(JSON.stringify(await Effect.runPromise(daemon.routeOperatorMessage({ project, title, body: bodyParts.join(" ") || undefined })), null, 2));
        await Effect.runPromise(daemon.stop());
        return;
    }
    if (command === "claim") {
        const [project, messageId] = process.argv.slice(3);
        if (!project || !messageId)
            throw new Error("usage: pi-gateway-daemon claim <project> <message-id>");
        await Effect.runPromise(daemon.start());
        console.log(JSON.stringify(await Effect.runPromise(daemon.claimProjectMessage({ project, messageId })), null, 2));
        await Effect.runPromise(daemon.stop());
        return;
    }
    if (command !== "run") {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
    await Effect.runPromise(daemon.start());
    console.log("pi-gateway System Gateway Daemon running");
    const shutdown = async () => {
        await Effect.runPromise(daemon.stop());
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    setInterval(() => {
        void Effect.runPromise(daemon.rebuildIndex()).catch((error) => {
            daemon.actor.send({ type: "gateway.fail", error: error instanceof Error ? error.message : String(error) });
            console.error("[system-gateway] index rebuild failed", error);
        });
    }, Number(process.env.PI_GATEWAY_INDEX_INTERVAL_MS ?? 60_000));
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
