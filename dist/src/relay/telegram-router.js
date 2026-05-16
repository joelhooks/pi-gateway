import { join } from "node:path";
import { Effect } from "effect";
import { GatewayStore } from "../store.js";
import { readTelegramContextState, saveTelegramContextState } from "./context-state.js";
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
        return readTelegramContextState(config.stateFile);
    }
    function saveRouterState(state) {
        saveTelegramContextState(config.stateFile, state);
    }
    function setThreadContext(threadId, projectId, attachedAgentId) {
        const state = readRouterState();
        state.threads[threadId] = { projectId, attachedAgentId, updatedAt: new Date().toISOString() };
        saveRouterState(state);
        return state.threads[threadId];
    }
    function clearAttachment(threadId) {
        const state = readRouterState();
        const current = state.threads[threadId];
        if (!current)
            return undefined;
        state.threads[threadId] = { projectId: current.projectId, updatedAt: new Date().toISOString() };
        saveRouterState(state);
        return state.threads[threadId];
    }
    function threadContext(threadId) {
        return readRouterState().threads[threadId];
    }
    function liveAgentFor(project, agents) {
        return agents.find((agent) => agent.status !== "stopped" && (!agent.cwd || agent.cwd === project.root || agent.cwd.startsWith(project.root)));
    }
    function parseCommand(text) {
        const trimmed = text.trim();
        const routeAlternates = ["gateway", ...Array.from(aliases.keys())]
            .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|");
        const slash = trimmed.match(new RegExp(`^/(${routeAlternates})(?:@(\\w+))?(?:\\s+(.*))?$`, "i"));
        if (slash) {
            const route = slash[1].toLowerCase();
            const rest = (slash[3] ?? "").trim();
            return { project: route === "gateway" ? undefined : route, command: rest || (route === "gateway" ? "status" : "activate") };
        }
        const mention = trimmed.match(new RegExp(`^(#)?(${routeAlternates})(\\s|$)`, "i"));
        if (mention) {
            const route = mention[2].toLowerCase();
            const rest = trimmed.slice(mention[0].length).trim();
            return { project: route === "gateway" ? undefined : route, command: rest || "status" };
        }
        if (/^(help|commands|what can you do)\??$/i.test(trimmed))
            return { project: undefined, command: "help" };
        if (/^\/help(?:@\w+)?$/i.test(trimmed))
            return { project: undefined, command: "help" };
        if (/^(status|are you running|you running)\??$/i.test(trimmed))
            return { project: undefined, command: "status" };
        if (/^(list|messages|queue|what messages\??|show messages)$/i.test(trimmed))
            return { project: undefined, command: "list" };
        if (/^(where am i|whereami|context)\??$/i.test(trimmed))
            return { project: undefined, command: "where" };
        if (/^(detach|disconnect)\??$/i.test(trimmed))
            return { project: undefined, command: "detach" };
        return undefined;
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
        if (!parsed) {
            const current = threadContext(threadId);
            if (!current?.projectId)
                return undefined;
            const selected = projectFor(current.projectId);
            const state = await Effect.runPromise(GatewayStore.fromRoot(selected.root).readState());
            const agent = current.attachedAgentId ? state.agents.find((item) => item.id === current.attachedAgentId) : liveAgentFor(selected, state.agents);
            const wakeRequested = !agent;
            const message = await Effect.runPromise(GatewayStore.fromRoot(selected.root).publish({
                from: `telegram:${threadId}`,
                to: agent?.id,
                title: text.trim().slice(0, 80),
                body: text.trim(),
                metadata: { contextMode: true, projectId: selected.id, attachedAgentId: agent?.id, agentWakeRequested: wakeRequested },
            }));
            if (agent)
                setThreadContext(threadId, selected.id, agent.id);
            return agent
                ? `sent to ${selected.id} agent ${agent.name || agent.id}: ${message.id}`
                : `🐀 ${selected.id} context active. No live Project Agent found, so I queued this as Operator Message ${message.id} and requested Agent Wake.`;
        }
        const [verb, ...rest] = parsed.command.split(/\s+/);
        const project = projectFor(parsed.project);
        const store = GatewayStore.fromRoot(project.root);
        if (["help", "?"].includes(verb)) {
            const routes = config.projects.map((item) => `/${item.id}`).join(", ");
            return `🐀 ShitRat commands\n\nTelegram slash commands:\n/gateway — status for the default project\n/aihero — activate AI Hero context\n/help — show commands\n\nContext commands:\nwhere am i\ndetach\nmessages\nstatus\n\nText commands:\ngateway list [project]\ngateway claim <id> [project]\ngateway publish <title> -- <body>\naihero list|claim|publish\n\nProject slash aliases: ${routes}`;
        }
        if (verb === "activate") {
            const state = await Effect.runPromise(store.readState());
            const agent = liveAgentFor(project, state.agents);
            setThreadContext(threadId, project.id, agent?.id);
            if (agent)
                return `🐀 activated ${project.id} context and attached to ${agent.name || agent.id}. Unprefixed messages go there now.`;
            return `🐀 activated ${project.id} context. No live Project Agent found; unprefixed messages will queue Operator Messages and request Agent Wake.`;
        }
        if (verb === "where") {
            const current = threadContext(threadId);
            if (!current?.projectId)
                return "🐀 no active context. Use /aihero to activate one.";
            return `🐀 context: ${current.projectId}\nattachment: ${current.attachedAgentId ?? "none"}`;
        }
        if (verb === "detach") {
            const current = clearAttachment(threadId);
            if (!current?.projectId)
                return "🐀 no active context to detach.";
            return `🐀 detached live agent. Context remains ${current.projectId}.`;
        }
        if (verb === "status") {
            const selected = parsed.project ? project : projectFor(threadContext(threadId)?.projectId);
            const state = await Effect.runPromise(GatewayStore.fromRoot(selected.root).readState());
            return `🐀 ${selected.id} gateway: ${state.messages.length} messages, ${state.agents.length} agents`;
        }
        if (["list", "queue"].includes(verb)) {
            const selected = projectFor(rest[0] || parsed.project || threadContext(threadId)?.projectId);
            const messages = await Effect.runPromise(GatewayStore.fromRoot(selected.root).listMessages({ limit: 50 }));
            return formatMessages(selected.id, messages);
        }
        if (verb === "claim") {
            const id = rest[0];
            const selected = projectFor(rest[1] || parsed.project || threadContext(threadId)?.projectId);
            if (!id)
                return "usage: gateway claim <message-id> [project]";
            const claimed = await Effect.runPromise(GatewayStore.fromRoot(selected.root).claim(id, `telegram:${threadId}`));
            return claimed ? `claimed ${id}` : `nothing claimed for ${id}`;
        }
        if (verb === "publish") {
            const raw = rest.join(" ");
            const [title, body = ""] = raw.split(/\s+--\s+/, 2);
            if (!title)
                return "usage: gateway publish <title> -- <body>";
            const message = await Effect.runPromise(store.publish({ from: `telegram:${threadId}`, title, body: body || undefined }));
            return `published ${message.id}`;
        }
        return `unknown gateway command: ${verb}\ntry help`;
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
        saveRouterState({ ...state, seenMessageIds: Array.from(seen).slice(-300) });
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
