# pi-gateway

A Pi package for a project-local gateway message bus.

v0 gives agents a durable message bus via a Pi extension tool:

- publish messages to configurable channels
- list new/claimed/resolved messages
- claim messages for gateway-agent work
- heartbeat active agents
- keep lifecycle explicit with XState
- keep filesystem side effects isolated behind Effect services

Telegram relay is planned as an optional adapter layered on top of the same bus.

## Install locally

```bash
pi install /Users/joel/Code/joelhooks/pi-gateway
```

Or test directly:

```bash
pi -e /Users/joel/Code/joelhooks/pi-gateway
```

## Tool

```ts
pi_gateway({ action: "publish", channel: "default", from: "agent", title: "hello" })
pi_gateway({ action: "list", status: "new" })
pi_gateway({ action: "claim", id: "msg_...", claimant: "gateway-agent" })
pi_gateway({ action: "heartbeat", agentId: "gateway-agent", agentName: "gateway-agent" })
pi_gateway({ action: "status" })
```

## State files

In each project:

```text
.pi/gateway/config.json
.pi/gateway/state.json
```

## Architecture

XState owns gateway lifecycle modes. Effect owns side effects and data access.

```text
stopped -> running -> degraded
   ^         |          |
   +---------+----------+
```
