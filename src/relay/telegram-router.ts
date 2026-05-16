import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { Effect } from "effect";
import { GatewayStore } from "../store.js";
import type { GatewayAgentHeartbeat, GatewayMessage } from "../schema.js";
import { readTelegramContextState, saveTelegramContextState, type TelegramContextState } from "./context-state.js";

export type TelegramRouterProject = {
  id: string;
  root: string;
  aliases?: string[];
  wakeCommand?: string | false;
};

export type TelegramRouterConfig = {
  projects: TelegramRouterProject[];
  defaultProjectId: string;
  stateFile: string;
};

export type TelegramChannel = {
  post: (message: string | { markdown?: string; text?: string }) => Promise<unknown>;
};

export function createTelegramRouter(config: TelegramRouterConfig) {
  const aliases = new Map<string, TelegramRouterProject>();
  for (const project of config.projects) {
    aliases.set(project.id.toLowerCase(), project);
    for (const alias of project.aliases ?? []) aliases.set(alias.toLowerCase(), project);
  }

  function projectFor(input?: string) {
    const key = (input || config.defaultProjectId).toLowerCase();
    return aliases.get(key) ?? aliases.get(config.defaultProjectId.toLowerCase()) ?? config.projects[0];
  }

  function readRouterState(): TelegramContextState {
    return readTelegramContextState(config.stateFile);
  }

  function saveRouterState(state: TelegramContextState) {
    saveTelegramContextState(config.stateFile, state);
  }

  function setThreadContext(threadId: string, projectId: string, attachedAgentId?: string) {
    const state = readRouterState();
    state.threads[threadId] = { projectId, attachedAgentId, updatedAt: new Date().toISOString() };
    saveRouterState(state);
    return state.threads[threadId];
  }

  function clearAttachment(threadId: string) {
    const state = readRouterState();
    const current = state.threads[threadId];
    if (!current) return undefined;
    state.threads[threadId] = { projectId: current.projectId, updatedAt: new Date().toISOString() };
    saveRouterState(state);
    return state.threads[threadId];
  }

  function threadContext(threadId: string) {
    return readRouterState().threads[threadId];
  }

  function liveAgentFor(project: TelegramRouterProject, agents: readonly GatewayAgentHeartbeat[]) {
    return agents.find((agent) => agent.status !== "stopped" && (!agent.cwd || agent.cwd === project.root || agent.cwd.startsWith(project.root)));
  }

  function defaultWakeCommand(project: TelegramRouterProject) {
    const prompt = `You are the ${project.id} Project Agent woken by ShitRat through pi-gateway. Start by reading the local Project Gateway messages, heartbeat as ${project.id}-telegram-agent if pi_gateway is available, then respond to pending Operator Messages. Stay in this project context.`;
    return `cmux pi --model openai-codex/gpt-5.5 ${JSON.stringify(prompt)}`;
  }

  function wakeProjectAgent(project: TelegramRouterProject) {
    if (project.wakeCommand === false) return { ok: false, error: "agent wake disabled" };
    const command = project.wakeCommand || defaultWakeCommand(project);
    const result = spawnSync("cmux", ["new-workspace", "--name", `${project.id}-agent`, "--cwd", project.root, "--command", command, "--focus", "false"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    return {
      ok: result.status === 0,
      command,
      output: (result.stdout || result.stderr || "").trim(),
      error: result.error?.message || (result.status === 0 ? undefined : `cmux exited ${result.status}`),
    };
  }

  function projectAgentWorkspace(project: TelegramRouterProject) {
    const result = spawnSync("cmux", ["list-workspaces"], { encoding: "utf8", timeout: 5_000 });
    const line = result.stdout.split("\n").find((item) => new RegExp(`workspace:\\d+\\s+${project.id}-agent(?:\\s|$)`).test(item));
    return line?.match(/workspace:\d+/)?.[0];
  }

  function firstSurfaceInWorkspace(workspace: string) {
    const result = spawnSync("cmux", ["tree"], { encoding: "utf8", timeout: 5_000 });
    const lines = result.stdout.split("\n");
    const start = lines.findIndex((line) => line.includes(`workspace ${workspace} `));
    if (start < 0) return undefined;
    const nextWorkspace = lines.findIndex((line, index) => index > start && /workspace workspace:\d+/.test(line));
    const block = lines.slice(start, nextWorkspace < 0 ? undefined : nextWorkspace).join("\n");
    return block.match(/surface:\d+/)?.[0];
  }

  function nudgeProjectAgent(project: TelegramRouterProject, messageId: string, text: string) {
    const workspace = projectAgentWorkspace(project);
    if (!workspace) return { ok: false, error: `workspace ${project.id}-agent not found` };
    const surface = firstSurfaceInWorkspace(workspace);
    if (!surface) return { ok: false, error: `surface not found in ${workspace}` };
    const prompt = `New Telegram context message ${messageId} in ${project.id}: ${JSON.stringify(text)}. Read .pi/gateway/state/state.json, claim ${messageId}, answer it, publish a response to the Telegram sender if needed, then keep watching for new context messages.\n`;
    const result = spawnSync("cmux", ["send", "--workspace", workspace, "--surface", surface, prompt], { encoding: "utf8", timeout: 5_000 });
    return { ok: result.status === 0, output: (result.stdout || result.stderr || "").trim(), error: result.error?.message || (result.status === 0 ? undefined : `cmux exited ${result.status}`) };
  }

  function parseCommand(text: string) {
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

    if (/^(help|commands|what can you do)\??$/i.test(trimmed)) return { project: undefined, command: "help" };
    if (/^\/help(?:@\w+)?$/i.test(trimmed)) return { project: undefined, command: "help" };
    if (/^(status|are you running|you running)\??$/i.test(trimmed)) return { project: undefined, command: "status" };
    if (/^(list|messages|queue|what messages\??|show messages)$/i.test(trimmed)) return { project: undefined, command: "list" };
    if (/^(where am i|whereami|context)\??$/i.test(trimmed)) return { project: undefined, command: "where" };
    if (/^(detach|disconnect)\??$/i.test(trimmed)) return { project: undefined, command: "detach" };
    return undefined;
  }

  function formatMessages(projectId: string, messages: readonly GatewayMessage[]) {
    if (!messages.length) return `🐀 ${projectId} gateway: no messages`;
    return messages.slice(-10).map((message) => [
      `[${message.id}] ${message.severity}/${message.status} ${message.channel}: ${message.title}`,
      message.body,
    ].filter(Boolean).join("\n")).join("\n\n");
  }

  async function handle(text: string, threadId = "telegram") {
    const parsed = parseCommand(text);
    if (!parsed) {
      const current = threadContext(threadId);
      if (!current?.projectId) return undefined;
      const selected = projectFor(current.projectId);
      const state = await Effect.runPromise(GatewayStore.fromRoot(selected.root).readState());
      const agent = current.attachedAgentId ? state.agents.find((item) => item.id === current.attachedAgentId) : liveAgentFor(selected, state.agents);
      const wake = agent ? undefined : wakeProjectAgent(selected);
      const wakeRequested = !agent;
      const message = await Effect.runPromise(GatewayStore.fromRoot(selected.root).publish({
        from: `telegram:${threadId}`,
        to: agent?.id,
        title: text.trim().slice(0, 80),
        body: text.trim(),
        metadata: { contextMode: true, projectId: selected.id, attachedAgentId: agent?.id, agentWakeRequested: wakeRequested, agentWakeOk: wake?.ok, agentWakeOutput: wake?.output, agentWakeError: wake?.error },
      }));
      const nudge = agent ? nudgeProjectAgent(selected, message.id, text.trim()) : undefined;
      if (agent) setThreadContext(threadId, selected.id, agent.id);
      return agent
        ? `queued ${message.id} for ${selected.id} agent ${agent.name || agent.id}${nudge?.ok ? " and nudged its cmux session" : `, but cmux nudge failed: ${nudge?.error || nudge?.output || "unknown error"}`}`
        : `🐀 ${selected.id} context active. I queued Operator Message ${message.id} and ${wake?.ok ? `woke an agent (${wake.output || "cmux ok"})` : `tried to wake an agent but failed: ${wake?.error || wake?.output || "unknown error"}`}.`;
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
      const wake = agent ? undefined : wakeProjectAgent(project);
      setThreadContext(threadId, project.id, agent?.id);
      if (agent) return `🐀 activated ${project.id} context and attached to ${agent.name || agent.id}. Unprefixed messages go there now.`;
      return `🐀 activated ${project.id} context. No live Project Agent found, so ${wake?.ok ? `I woke one (${wake.output || "cmux ok"})` : `I tried to wake one but failed: ${wake?.error || wake?.output || "unknown error"}`}. Unprefixed messages will queue Operator Messages there.`;
    }

    if (verb === "where") {
      const current = threadContext(threadId);
      if (!current?.projectId) return "🐀 no active context. Use /aihero to activate one.";
      return `🐀 context: ${current.projectId}\nattachment: ${current.attachedAgentId ?? "none"}`;
    }

    if (verb === "detach") {
      const current = clearAttachment(threadId);
      if (!current?.projectId) return "🐀 no active context to detach.";
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
      if (!id) return "usage: gateway claim <message-id> [project]";
      const claimed = await Effect.runPromise(GatewayStore.fromRoot(selected.root).claim(id, `telegram:${threadId}`));
      return claimed ? `claimed ${id}` : `nothing claimed for ${id}`;
    }

    if (verb === "publish") {
      const raw = rest.join(" ");
      const [title, body = ""] = raw.split(/\s+--\s+/, 2);
      if (!title) return "usage: gateway publish <title> -- <body>";
      const message = await Effect.runPromise(store.publish({ from: `telegram:${threadId}`, title, body: body || undefined }));
      return `published ${message.id}`;
    }

    return `unknown gateway command: ${verb}\ntry help`;
  }

  async function pollNotifications(channel: TelegramChannel) {
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

export function defaultRouterConfig(options?: Partial<TelegramRouterConfig>): TelegramRouterConfig {
  const defaultRoot = process.env.PI_GATEWAY_DEFAULT_ROOT ?? process.cwd();
  return {
    defaultProjectId: process.env.PI_GATEWAY_DEFAULT_PROJECT ?? "default",
    stateFile: process.env.PI_GATEWAY_TELEGRAM_STATE ?? join(process.env.HOME ?? process.cwd(), ".pi", "gateway-telegram-router.json"),
    projects: [{ id: process.env.PI_GATEWAY_DEFAULT_PROJECT ?? "default", root: defaultRoot, aliases: [] }],
    ...options,
  };
}
