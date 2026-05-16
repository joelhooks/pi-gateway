# pi-gateway

A Pi package for a project-local gateway message bus.

v0 gives agents a durable message bus via a Pi extension tool:

- publish messages to configurable channels
- list new/claimed/resolved messages
- claim messages for gateway-agent work
- heartbeat active agents
- keep lifecycle explicit with XState
- keep filesystem side effects isolated behind Effect services

Telegram relay is included as an optional adapter layered on top of the same bus. The relay router can live inside an existing launchd Telegram bot or a dedicated relay process.

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

## Global relay config

The standalone Telegram relay reads machine-local config from:

```text
~/.pi-gateway/config.json
~/.pi-gateway/credentials.json
```

Use `config.example.json` and `credentials.example.json` as templates. Do not commit real credentials.

## System Gateway Daemon

The machine-level ShitRat daemon is available as:

```bash
pi-gateway-daemon run
pi-gateway-daemon status
pi-gateway-daemon projects
pi-gateway-daemon reindex
```

It reads machine-local config from `~/.pi-gateway/config.json`, keeps project messages in their source Project Gateways, and stores only a rebuildable `gateway-index.json` in gateway home.

## Telegram launchd router

Reusable router module:

```ts
import { createTelegramRouter } from "pi-gateway/src/relay/telegram-router"
```

Example shim for this machine lives at:

```text
launchd-telegram-relay/pi-gateway-router.mjs
```

It supports:

```text
/gateway status
/gateway list [project]
/gateway claim <message-id> [project]
/gateway publish <title> -- <body>
/<project> status|list|claim|publish
```

## State files

In each project:

```text
.pi/gateway/config.json
.pi/gateway/state/state.json
```

## Commands

```bash
npm test
npm run typecheck
npm run build
```

## Architecture

XState owns gateway lifecycle modes. Effect owns side effects and data access.

```text
stopped -> running -> degraded
   ^         |          |
   +---------+----------+
```
