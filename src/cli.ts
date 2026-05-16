#!/usr/bin/env node
import { Effect } from "effect";
import { GatewayStore } from "./store.js";

function parseArgs(argv: string[]) {
  const [cmd = "status", ...rest] = argv;
  const root = process.env.PI_GATEWAY_ROOT ?? process.cwd();
  return { cmd, rest, root };
}

async function main() {
  const { cmd, rest, root } = parseArgs(process.argv.slice(2));
  const store = GatewayStore.fromRoot(root);

  if (cmd === "publish") {
    const [title, ...bodyParts] = rest;
    if (!title) throw new Error("usage: pi-gateway publish <title> [body]");
    const message = await Effect.runPromise(store.publish({ from: "cli", title, body: bodyParts.join(" ") || undefined }));
    console.log(JSON.stringify({ ok: true, message }, null, 2));
    return;
  }

  if (cmd === "list") {
    const messages = await Effect.runPromise(store.listMessages({ limit: 50 }));
    console.log(JSON.stringify({ ok: true, messages }, null, 2));
    return;
  }

  if (cmd === "claim") {
    const [id, claimant = "cli"] = rest;
    if (!id) throw new Error("usage: pi-gateway claim <id> [claimant]");
    const claimed = await Effect.runPromise(store.claim(id, claimant));
    console.log(JSON.stringify({ ok: Boolean(claimed), claimed }, null, 2));
    return;
  }

  const state = await Effect.runPromise(store.readState());
  console.log(JSON.stringify({ ok: true, messages: state.messages.length, agents: state.agents.length, statePath: store.paths.statePath }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
