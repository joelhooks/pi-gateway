#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { Effect } from "effect";
import { GatewayStore } from "./store.js";

const [root, projectId, messageId, telegramThreadId] = process.argv.slice(2);
if (!root || !projectId || !messageId || !telegramThreadId) {
  console.error("usage: agent-worker <root> <project-id> <message-id> <telegram-thread-id>");
  process.exit(1);
}

const store = GatewayStore.fromRoot(root);
const state = await Effect.runPromise(store.readState());
const message = state.messages.find((item) => item.id === messageId);
if (!message) {
  console.error(`message not found: ${messageId}`);
  process.exit(1);
}

await Effect.runPromise(store.claim(messageId, `${projectId}-telegram-worker`));

const prompt = `You are the ${projectId} Project Agent woken by ShitRat through pi-gateway.
Working directory: ${root}

Joel sent this Telegram context message:
${message.body || message.title}

Answer Joel directly and concisely. If he pasted a link, inspect/reason about it from this project context. Do not mention gateway plumbing unless it is relevant.`;

const result = spawnSync("pi", ["--model", "openai-codex/gpt-5.5", "-p", prompt], {
  cwd: root,
  encoding: "utf8",
  timeout: 180_000,
  env: { ...process.env },
});

const body = result.status === 0
  ? result.stdout.trim()
  : `Project agent failed while answering ${messageId}: ${(result.stderr || result.stdout || result.error?.message || `exit ${result.status}`).trim()}`;

await Effect.runPromise(store.publish({
  from: `${projectId}-telegram-worker`,
  to: telegramThreadId,
  title: message.title,
  body: body || "Done.",
  metadata: { replyTo: messageId, projectId, worker: true },
}));
