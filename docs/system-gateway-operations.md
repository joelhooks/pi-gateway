# System Gateway Operations

## Model

- **System Gateway Daemon**: machine-level ShitRat process.
- **Project Gateway**: project-local durable bus in `.pi/gateway/`.
- **Project Registry**: explicit list of routable projects in `~/.pi-gateway/config.json`.
- **Gateway Index**: rebuildable cache in `~/.pi-gateway/gateway-index.json`.
- **Relay**: external transport actor such as Telegram.

## Machine config

```text
~/.pi-gateway/config.json
~/.pi-gateway/credentials.json
```

`config.json` contains registered projects and non-secret relay settings. `credentials.json` contains tokens and should be `0600`.

## Commands

```bash
pi-gateway-daemon status
pi-gateway-daemon projects
pi-gateway-daemon reindex
pi-gateway-daemon route aihero "Title" "Body"
pi-gateway-daemon claim aihero msg_...
pi-gateway-daemon run
```

## Launchd

The launchd plist template lives in:

```text
launchd/com.pi-gateway.telegram-relay.plist
```

Install or update locally:

```bash
cp launchd/com.pi-gateway.telegram-relay.plist ~/Library/LaunchAgents/
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.pi-gateway.telegram-relay.plist 2>/dev/null || true
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.pi-gateway.telegram-relay.plist
launchctl kickstart -k gui/$(id -u)/com.pi-gateway.telegram-relay
```

Check status:

```bash
launchctl print gui/$(id -u)/com.pi-gateway.telegram-relay
```

Logs:

```text
~/Library/Logs/pi-gateway-telegram-relay.out.log
~/Library/Logs/pi-gateway-telegram-relay.err.log
```

## Register a project

Add the project to `~/.pi-gateway/config.json`:

```json
{
  "defaultProjectId": "aihero",
  "projects": [
    { "id": "aihero", "root": "/Users/joel/Code/badass-courses/aihero-support", "aliases": ["ai-hero"] }
  ]
}
```

Then verify:

```bash
pi-gateway-daemon projects
pi-gateway-daemon route aihero "smoke" "from ShitRat"
```

## Safety boundary

ShitRat may route **Operator Messages** into registered project channels. Project agents still enforce project-local safety rules for destructive or customer-visible work.

## Troubleshooting

- If Telegram stops responding, check launchd status and error logs.
- If a project route fails, verify it is in the Project Registry and the root path exists.
- If messages look stale, run `pi-gateway-daemon reindex`; the Gateway Index is rebuildable.
- If credentials fail, verify `~/.pi-gateway/credentials.json` exists, has the Telegram token, and is not committed.
