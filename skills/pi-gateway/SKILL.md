---
name: pi-gateway
description: Use the pi-gateway extension message bus for agent-to-agent coordination, gateway-agent announcements, project channels, and optional Telegram relay routing.
---

# Pi Gateway

Use `pi_gateway` when a task needs durable cross-session/project communication instead of ad hoc tmux poking.

## Core tool calls

Publish a message:

```ts
pi_gateway({
  action: "publish",
  channel: "aihero",
  from: "worker-name",
  to: "gateway",
  title: "Preview blocked",
  body: "Need Vercel bypass env var for smoke test.",
  severity: "warn"
})
```

List messages:

```ts
pi_gateway({ action: "list", channel: "aihero", status: "new" })
```

Claim a message:

```ts
pi_gateway({ action: "claim", id: "msg_...", claimant: "gateway-agent" })
```

Heartbeat:

```ts
pi_gateway({ action: "heartbeat", agentId: "gateway-agent", agentName: "gateway-agent", status: "watching" })
```

## Behavior rules

- Prefer channels over one-off files.
- Use `severity: "warn"` only when human attention may be needed.
- Use `severity: "error"` only for failed/blocking work.
- Do not put secrets in messages. Reference secret names only.
- For Telegram relay, keep messages short and actionable.
