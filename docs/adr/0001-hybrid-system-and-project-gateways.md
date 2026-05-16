# Hybrid System Gateway and Project Gateways

We will model Pi Gateway as a hybrid local network: each project owns a durable **Project Gateway** and the machine runs one **System Gateway Daemon** that indexes and routes across the explicit **Project Registry**. This keeps project message state local and rebuildable while letting **ShitRat** act as the operator-facing **System Gateway** through relays such as Telegram.

## Considered Options

- One global gateway state file for every project.
- Fully independent project gateways with no system-level router.
- Hybrid project-owned buses plus a system-level registry, index, and relays.

## Consequences

- Project messages are physically stored in project gateways; the system gateway keeps only a rebuildable index.
- Auto-discovery may suggest projects, but routing requires the project to be in the Project Registry.
- Telegram is a Relay actor inside the System Gateway Daemon, not the daemon itself.
- ShitRat can read and write registered channels, but destructive or customer-visible execution remains enforced by Project Agents.
