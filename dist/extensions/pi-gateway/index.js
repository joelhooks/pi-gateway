import { Type } from "typebox";
import { Effect } from "effect";
import { createActor } from "xstate";
import { GatewayStore } from "../../src/store.js";
import { gatewayMachine } from "../../src/machine.js";
import { formatTelegramMessage, sendTelegramMessage, shouldRelayToTelegram } from "../../src/telegram.js";
function runEffect(effect) {
    return Effect.runPromise(effect);
}
function text(content, details = {}) {
    return { content: [{ type: "text", text: content }], details };
}
export default function (pi) {
    let actor;
    pi.on("session_start", async (_event, ctx) => {
        const root = ctx.cwd ?? process.cwd();
        const store = GatewayStore.fromRoot(root);
        await runEffect(store.ensure());
        actor = createActor(gatewayMachine, { input: { root } });
        actor.start();
        actor.send({ type: "gateway.start" });
        ctx.ui.setStatus("pi-gateway", "gateway running");
        const pollMs = Number(process.env.PI_GATEWAY_RELAY_INTERVAL_MS ?? 60_000);
        const relayTick = async () => {
            const token = process.env.PI_GATEWAY_TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
            if (!token)
                return;
            const config = await runEffect(store.readConfig());
            const messages = await runEffect(store.listMessages({ status: "new", limit: 50 }));
            for (const channel of config.channels) {
                if (channel.kind !== "telegram")
                    continue;
                for (const message of messages) {
                    if (!shouldRelayToTelegram(message, channel))
                        continue;
                    if (message.receipts.some((receipt) => receipt.event === "telegram-relayed" && receipt.note === channel.id))
                        continue;
                    await runEffect(sendTelegramMessage({ token, chatId: channel.chatId, text: formatTelegramMessage(message) }));
                    await runEffect(store.addReceipt(message.id, "telegram-relayed", channel.id));
                }
            }
        };
        const timer = setInterval(() => relayTick().catch((error) => ctx.ui.notify(`pi-gateway telegram relay failed: ${error.message}`, "warning")), pollMs);
        void timer.unref?.();
        void relayTick().catch(() => undefined);
    });
    pi.registerTool({
        name: "pi_gateway",
        label: "Pi Gateway",
        description: "Project-local system message bus for gateway agents, peer agents, and optional relays.",
        parameters: Type.Object({
            action: Type.String({ description: "publish, list, claim, heartbeat, or status" }),
            channel: Type.Optional(Type.String({ description: "Channel id. Defaults to default." })),
            to: Type.Optional(Type.String({ description: "Target agent or route." })),
            title: Type.Optional(Type.String({ description: "Message title for publish." })),
            body: Type.Optional(Type.String({ description: "Message body for publish." })),
            severity: Type.Optional(Type.Union([Type.Literal("info"), Type.Literal("warn"), Type.Literal("error")])),
            id: Type.Optional(Type.String({ description: "Message id for claim." })),
            claimant: Type.Optional(Type.String({ description: "Claimant name." })),
            agentId: Type.Optional(Type.String({ description: "Agent id for heartbeat." })),
            agentName: Type.Optional(Type.String({ description: "Agent name for heartbeat." })),
            status: Type.Optional(Type.String({ description: "Message status filter or agent status." })),
            limit: Type.Optional(Type.Number({ description: "List limit." })),
        }),
        async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
            const store = GatewayStore.fromRoot(ctx.cwd ?? process.cwd());
            const action = params.action;
            if (action === "publish") {
                if (!params.title)
                    return text("title is required for publish", { ok: false });
                const message = await runEffect(store.publish({
                    channel: params.channel,
                    from: params.agentName ?? "agent",
                    to: params.to,
                    title: params.title,
                    body: params.body,
                    severity: params.severity ?? "info",
                }));
                actor?.send({ type: "message.published", message });
                return text(`published ${message.id} to ${message.channel}`, { ok: true, message });
            }
            if (action === "list") {
                const messages = await runEffect(store.listMessages({ channel: params.channel, status: params.status, limit: params.limit }));
                const lines = messages.map((message) => `[${message.id}] ${message.severity}/${message.status} ${message.channel}: ${message.title}`);
                return text(lines.join("\n") || "no messages", { ok: true, messages });
            }
            if (action === "claim") {
                if (!params.id)
                    return text("id is required for claim", { ok: false });
                const claimed = await runEffect(store.claim(params.id, params.claimant ?? params.agentName ?? "agent"));
                return text(claimed ? `claimed ${claimed.id}` : `nothing claimed for ${params.id}`, { ok: Boolean(claimed), claimed });
            }
            if (action === "heartbeat") {
                const heartbeat = await runEffect(store.heartbeat({
                    id: params.agentId ?? params.agentName ?? "agent",
                    name: params.agentName ?? "agent",
                    cwd: ctx.cwd,
                    sessionId: process.env.PI_SESSION_ID,
                    status: params.status,
                }));
                return text(`heartbeat ${heartbeat?.name}`, { ok: true, heartbeat });
            }
            if (action === "status") {
                const state = await runEffect(store.readState());
                const snapshot = actor?.getSnapshot();
                return text(`pi-gateway ${snapshot?.value ?? "unknown"}: ${state.messages.length} messages, ${state.agents.length} agents`, {
                    ok: true,
                    gateway: snapshot?.value,
                    state,
                });
            }
            return text(`unknown pi_gateway action: ${action}`, { ok: false });
        },
    });
    pi.registerCommand("gateway", {
        description: "Show pi-gateway status",
        handler: async (_args, ctx) => {
            const store = GatewayStore.fromRoot(ctx.cwd ?? process.cwd());
            const state = await runEffect(store.readState());
            ctx.ui.notify(`pi-gateway: ${state.messages.length} messages, ${state.agents.length} agents`, "info");
        },
    });
}
