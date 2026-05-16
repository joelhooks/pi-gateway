import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { GatewayStore } from "../store.js";
export function createTelegramRouter(config) {
    const aliases = new Map();
    for (const project of config.projects) {
        aliases.set(project.id.toLowerCase(), project);
        for (const alias of project.aliases ?? [])
            aliases.set(alias.toLowerCase(), project);
    }
    function projectFor(input) {
        const key = (input || config.defaultProjectId).toLowerCase();
        return aliases.get(key) ?? aliases.get(config.defaultProjectId.toLowerCase()) ?? config.projects[0];
    }
    function readRouterState() {
        try {
            return JSON.parse(readFileSync(config.stateFile, "utf8"));
        }
        catch {
            return { seenMessageIds: [] };
        }
    }
    function saveRouterState(state) {
        mkdirSync(dirname(config.stateFile), { recursive: true });
        writeFileSync(config.stateFile, `${JSON.stringify(state, null, 2)}\n`);
    }
    function parseCommand(text) {
        const trimmed = text.trim();
        const routeAlternates = ["gateway", ...Array.from(aliases.keys())]
            .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|");
        const match = trimmed.match(new RegExp(`^(/|#)?(${routeAlternates})(\\s|$)`, "i"));
        if (!match)
            return undefined;
        const route = match[2].toLowerCase();
        const rest = trimmed.slice(match[0].length).trim();
        return { project: route === "gateway" ? undefined : route, command: rest || "status" };
    }
    function formatMessages(projectId, messages) {
        if (!messages.length)
            return `🐀 ${projectId} gateway: no messages`;
        return messages.slice(-10).map((message) => [
            `[${message.id}] ${message.severity}/${message.status} ${message.channel}: ${message.title}`,
            message.body,
        ].filter(Boolean).join("\n")).join("\n\n");
    }
    async function handle(text, threadId = "telegram") {
        const parsed = parseCommand(text);
        if (!parsed)
            return undefined;
        const [verb, ...rest] = parsed.command.split(/\s+/);
        const project = projectFor(parsed.project);
        const store = GatewayStore.fromRoot(project.root);
        if (["help", "?"].includes(verb)) {
            const routes = config.projects.map((item) => `/${item.id}`).join(", ");
            return `🐀 gateway commands\n/gateway status\n/gateway list [project]\n/gateway claim <id> [project]\n/gateway publish <title> -- <body>\nproject aliases: ${routes}`;
        }
        if (verb === "status") {
            const state = await Effect.runPromise(store.readState());
            return `🐀 ${project.id} gateway: ${state.messages.length} messages, ${state.agents.length} agents`;
        }
        if (["list", "queue"].includes(verb)) {
            const selected = projectFor(rest[0] || parsed.project);
            const messages = await Effect.runPromise(GatewayStore.fromRoot(selected.root).listMessages({ limit: 50 }));
            return formatMessages(selected.id, messages);
        }
        if (verb === "claim") {
            const id = rest[0];
            const selected = projectFor(rest[1] || parsed.project);
            if (!id)
                return "usage: /gateway claim <message-id> [project]";
            const claimed = await Effect.runPromise(GatewayStore.fromRoot(selected.root).claim(id, `telegram:${threadId}`));
            return claimed ? `claimed ${id}` : `nothing claimed for ${id}`;
        }
        if (verb === "publish") {
            const raw = rest.join(" ");
            const [title, body = ""] = raw.split(/\s+--\s+/, 2);
            if (!title)
                return "usage: /gateway publish <title> -- <body>";
            const message = await Effect.runPromise(store.publish({ from: `telegram:${threadId}`, title, body: body || undefined }));
            return `published ${message.id}`;
        }
        return `unknown gateway command: ${verb}\ntry /gateway help`;
    }
    async function pollNotifications(channel) {
        const state = readRouterState();
        const seen = new Set(state.seenMessageIds ?? []);
        for (const project of config.projects) {
            const messages = await Effect.runPromise(GatewayStore.fromRoot(project.root).listMessages({ status: "new", limit: 50 }));
            const important = messages
                .filter((message) => !seen.has(message.id))
                .filter((message) => ["warn", "error"].includes(message.severity) || /blocked|failed|approval|authorize|env|secret|human/i.test(`${message.title} ${message.body ?? ""}`))
                .slice(0, 5);
            for (const message of important) {
                await channel.post(formatMessages(project.id, [message]));
                seen.add(message.id);
            }
        }
        saveRouterState({ seenMessageIds: Array.from(seen).slice(-300) });
    }
    return { handle, pollNotifications, parseCommand };
}
export function defaultRouterConfig(options) {
    const defaultRoot = process.env.PI_GATEWAY_DEFAULT_ROOT ?? process.cwd();
    return {
        defaultProjectId: process.env.PI_GATEWAY_DEFAULT_PROJECT ?? "default",
        stateFile: process.env.PI_GATEWAY_TELEGRAM_STATE ?? join(process.env.HOME ?? process.cwd(), ".pi", "gateway-telegram-router.json"),
        projects: [{ id: process.env.PI_GATEWAY_DEFAULT_PROJECT ?? "default", root: defaultRoot, aliases: [] }],
        ...options,
    };
}
