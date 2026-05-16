# Pi Gateway

Pi Gateway is a local agent communication system for routing messages between Pi sessions, project workspaces, and optional external relays such as Telegram.

## Language

**System Gateway**:
A machine-level gateway process that indexes and routes messages across project gateways on the same computer.
_Avoid_: global gateway, central server

**Project Gateway**:
A project-local durable message bus stored inside a repo or workspace.
_Avoid_: app gateway, repo bot

**Channel**:
A named route within a gateway used to group messages by project, purpose, or audience.
_Avoid_: chat room, topic, queue

**Relay**:
An adapter that moves gateway messages between the local gateway network and an external transport.
_Avoid_: bot, integration

**System Gateway Daemon**:
A headless long-running process that owns the Project Registry, Gateway Index, and Relay actors for one machine.
_Avoid_: Telegram bot, Pi session

**ShitRat**:
The operator-facing System Gateway identity on Joel's machine, currently exposed through Telegram.
_Avoid_: MyClaw, assistant bot

**Local Gateway Network**:
The set of project gateways discoverable by the System Gateway on one machine.
_Avoid_: cluster, cloud network

**Project Registry**:
The explicit machine-local list of project gateways the System Gateway is allowed to route to.
_Avoid_: auto-discovery list, workspace scan

**Discovery Suggestion**:
A candidate project gateway found from local activity but not routable until added to the Project Registry.
_Avoid_: auto-registered project

**Project Agent**:
An agent operating inside a project gateway with authority to execute project-specific work.
_Avoid_: worker bot, repo assistant

**Operator Message**:
A message authored or approved by the human operator through the System Gateway.
_Avoid_: system command, admin action

**Gateway Index**:
A System Gateway cache of routable project messages used for fast status and notifications.
_Avoid_: source of truth, global inbox

**Context Mode**:
A per-operator Relay state that makes unprefixed messages target a selected Project Gateway.
_Avoid_: Telegram thread, chat room

**Agent Attachment**:
A per-operator Relay state that forwards unprefixed messages to a specific live Project Agent when one is available.
_Avoid_: context, default project

**Agent Wake**:
A System Gateway request to start or resume a Project Agent for a selected Project Gateway.
_Avoid_: auto-run, implicit shell command

## Relationships

- A **System Gateway** discovers and routes across many **Project Gateways**.
- A **System Gateway Daemon** is the durable runtime for a **System Gateway**.
- A **Project Gateway** owns its own durable state and exposes one or more **Channels**.
- A **Relay** belongs to the **System Gateway** when it bridges multiple projects.
- Telegram is a **Relay**, not the **System Gateway Daemon** itself.
- **ShitRat** is the operator-facing identity of the **System Gateway**, not a project gateway.
- The **Local Gateway Network** is machine-local unless an explicit relay connects it elsewhere.
- A **System Gateway** routes only to projects in the **Project Registry**.
- A **Discovery Suggestion** can become routable only after it is added to the **Project Registry**.
- **ShitRat** may read and write registered **Channels**, but risky execution remains owned by a **Project Agent**.
- An **Operator Message** can authorize direction, but it does not bypass project-local safety rules for destructive or customer-visible actions.
- A **Project Gateway** is the source of truth for its messages.
- A **Gateway Index** may cache project messages, but it must be rebuildable from registered Project Gateways.
- **Context Mode** selects the default Project Gateway for unprefixed Relay messages.
- **Agent Attachment** is stronger than Context Mode: it forwards unprefixed Relay messages to a live Project Agent instead of only writing to the Project Gateway.
- **Agent Wake** may create a live Project Agent for a Context Mode when no suitable Project Agent is available.

## Example dialogue

> **Dev:** "Should AI Hero run its own Telegram bot?"
> **Domain expert:** "No. AI Hero has a **Project Gateway**. **ShitRat**, the **System Gateway**, owns Telegram and routes `/aihero` commands into that project channel."

## Flagged ambiguities

- "gateway" was used for both the machine-level router and the project-local bus. Resolved: use **System Gateway** for the machine-level router and **Project Gateway** for repo-local state.
- "Telegram channel" was used to mean both Telegram chat transport and gateway route. Resolved: Telegram is a **Relay** transport; **Channel** is a gateway route.
- "MyClaw" was a transient tutorial app, not part of the Pi Gateway domain. Resolved: use **ShitRat** for the operator-facing System Gateway identity.
- Auto-discovered projects must not become routable by default. Resolved: discovery produces **Discovery Suggestions**; routing uses the **Project Registry**.
- Cross-project write authority does not imply execution authority. Resolved: **ShitRat** can write **Operator Messages** into registered channels; **Project Agents** still enforce project-local approval for destructive or customer-visible work.
- Message state must not be duplicated as competing sources of truth. Resolved: messages are physically stored in **Project Gateways**; **System Gateway** keeps only a rebuildable **Gateway Index**.
- The System Gateway must survive Pi session exits. Resolved: run a separate **System Gateway Daemon**; Telegram is only a **Relay** actor inside it.
- "Activate AI Hero context" could mean default project routing or live session chat. Resolved: **Context Mode** chooses the default Project Gateway; **Agent Attachment** explicitly connects to a live Project Agent when available.
- Project slash commands such as `/aihero` should activate **Context Mode**, then try **Agent Attachment** or **Agent Wake**. If no agent is available, unprefixed messages still become Operator Messages in the selected Project Gateway.
