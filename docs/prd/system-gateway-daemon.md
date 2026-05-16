## Problem Statement

Pi Gateway currently has a useful v0 Project Gateway and Telegram Relay, but ShitRat is not yet modeled as a durable System Gateway Daemon. The current relay can route Telegram commands into configured projects, but it is still too close to a transport shim: the Project Registry, Gateway Index, relay lifecycle, discovery suggestions, and routing authority need to become first-class System Gateway concepts.

The operator needs one machine-level ShitRat gateway that survives Pi session exits, reads and writes registered project channels, routes across the Local Gateway Network, and keeps Telegram as one Relay rather than letting each project or tutorial bot own its own Telegram integration.

## Solution

Build a System Gateway Daemon for Pi Gateway using the hybrid topology from the accepted ADR: each project owns its Project Gateway state, and the System Gateway Daemon owns the Project Registry, Gateway Index, and Relay actors. Telegram becomes an optional Relay actor under ShitRat. Projects register explicitly in machine-local config, while local activity may produce Discovery Suggestions that require operator approval before routing.

The daemon should expose a small, stable interface for listing registered projects, indexing project messages, routing Operator Messages, reporting daemon health, and running relays. Project Gateways remain the source of truth for their messages. The Gateway Index is rebuildable and must not become a competing global inbox.

## User Stories

1. As Joel, I want ShitRat to run as a System Gateway Daemon, so that the machine-level gateway survives Pi session exits.
2. As Joel, I want each repo to keep its own Project Gateway state, so that project messages stay local to the workspace that owns them.
3. As Joel, I want ShitRat to route across registered Project Gateways, so that I can coordinate multiple projects from one operator surface.
4. As Joel, I want the Project Registry to be explicit, so that random local repos do not become routable just because they were opened once.
5. As Joel, I want Discovery Suggestions for likely project gateways, so that setup is fast without unsafe auto-registration.
6. As Joel, I want Telegram to be a Relay actor inside the System Gateway Daemon, so that Telegram is not confused with the gateway itself.
7. As Joel, I want ShitRat to keep its Telegram identity, so that I can use the existing operator workflow while replacing the tutorial-era app.
8. As Joel, I want machine-local config in a dedicated gateway home, so that credentials and registry state are not scattered through transient project folders.
9. As Joel, I want credentials separated from config, so that public repo examples do not risk leaking real tokens.
10. As Joel, I want ShitRat to list registered projects, so that I can see what is connected to the Local Gateway Network.
11. As Joel, I want ShitRat to list messages for a project channel, so that I can inspect project work without opening a tmux pane.
12. As Joel, I want ShitRat to publish Operator Messages into a project channel, so that I can steer a Project Agent from Telegram or another relay.
13. As Joel, I want ShitRat to claim or acknowledge messages, so that notifications do not keep nagging after they have been handled.
14. As Joel, I want risky execution to remain owned by Project Agents, so that ShitRat does not bypass project-local safety rules for destructive or customer-visible work.
15. As a Project Agent, I want to receive Operator Messages from the System Gateway, so that I can act with clear human context inside my project.
16. As a Project Agent, I want to enforce project-local approval rules even when ShitRat routes a message, so that routing authority does not become execution authority.
17. As a Project Agent, I want to heartbeat into my Project Gateway, so that ShitRat can show whether active project workers exist.
18. As a System Gateway Daemon, I want to index registered Project Gateways, so that status and notification views are fast.
19. As a System Gateway Daemon, I want the Gateway Index to be rebuildable, so that index corruption does not destroy project message state.
20. As a System Gateway Daemon, I want explicit lifecycle states, so that running, degraded, stopped, and relay-failed modes are visible and testable.
21. As a System Gateway Daemon, I want to manage Relay actors independently, so that Telegram failures degrade the relay without taking down project indexing.
22. As a System Gateway Daemon, I want to record relay delivery receipts, so that messages are not repeatedly sent to Telegram.
23. As a Telegram Relay, I want to parse project aliases, so that commands like gateway status and project-specific aliases route predictably.
24. As a Telegram Relay, I want to send only important notifications by default, so that Telegram does not become notification sludge.
25. As a Telegram Relay, I want to accept generic gateway commands, so that adding a new project does not require custom per-project router code.
26. As a maintainer, I want the system daemon to be configured through documented examples, so that installation on a new machine is obvious.
27. As a maintainer, I want tests around routing and indexing behavior, so that changes do not silently break operator workflows.
28. As a maintainer, I want the daemon and relay code to use XState for lifecycle and Effect for side effects, so that the architecture stays explicit instead of becoming callback soup.
29. As a maintainer, I want the Project Registry and Discovery Suggestions to be separate concepts, so that convenience does not weaken routing boundaries.
30. As a maintainer, I want the public repo to contain the reusable gateway implementation, so that transient tutorial artifacts can be deleted safely.
31. As Joel, I want to delete the tutorial-era MyClaw app after the new relay is stable, so that ShitRat is not split across two concepts.
32. As Joel, I want logs and health checks for ShitRat, so that I can debug relay or daemon failures quickly.
33. As Joel, I want future relays to fit the same model as Telegram, so that Slack, webhooks, or local TUI surfaces can be added without redesigning the gateway.

## Implementation Decisions

- Respect the accepted hybrid topology: Project Gateways are the source of truth, and the System Gateway Daemon owns only registry, index, routing, and relays.
- Build the System Gateway Daemon as a headless long-running process, separate from any Pi session and separate from the Telegram Relay transport.
- Use XState for daemon lifecycle and actor coordination. The daemon should model states such as starting, running, degraded, stopping, stopped, and failed, plus child actor status for indexing and relays.
- Use Effect for filesystem, config, credential loading, project indexing, relay sending, and other side effects.
- Keep the Project Registry explicit in machine-local config. Discovery Suggestions may be generated later, but they must not become routable until registered.
- Keep credentials in a separate machine-local credentials file or environment source. Do not store real tokens in project config or repo examples.
- Extract a deep System Gateway module with a small API for starting the daemon, reading registry state, rebuilding the Gateway Index, routing Operator Messages, and reporting health.
- Extract a deep Project Gateway adapter module that can read, publish, claim, and inspect messages for a project without exposing storage details to the System Gateway.
- Extract a Relay interface that Telegram implements. Relay actors should receive normalized gateway events and report delivery receipts or failures.
- Keep Telegram as one Relay implementation, not the owner of routing logic.
- Preserve project-local safety boundaries. ShitRat may route Operator Messages, but Project Agents enforce destructive and customer-visible approval rules.
- Keep the current Pi extension tool as the Project Gateway interface, then add System Gateway commands/tools around registry, index, and relay status.
- Make the public package own all reusable code needed by launchd. Machine-local launchd plists may point at the package, but should not contain business logic.
- Keep MyClaw out of the domain model and remove it after the standalone System Gateway Daemon and Telegram Relay are stable.

## Testing Decisions

- Tests should assert external behavior: messages published through the System Gateway appear in the correct Project Gateway, Project Registry boundaries are enforced, and Telegram Relay delivery is recorded once.
- Test the Project Gateway adapter with temporary project roots and real filesystem state, matching the existing store tests.
- Test the System Gateway daemon lifecycle by sending machine events and asserting observable state transitions rather than implementation details.
- Test Gateway Index rebuild behavior by creating multiple temporary Project Gateways, rebuilding the index, and verifying the indexed view matches source project messages.
- Test Project Registry behavior separately from Discovery Suggestions: unregistered projects must not be routable even if discovered.
- Test Relay behavior with a fake Relay implementation before testing Telegram-specific formatting.
- Test Telegram command routing with project aliases, generic gateway commands, unknown commands, and claim/publish/list flows.
- Test credential/config loading with temporary gateway home directories and never require real Telegram credentials in automated tests.
- Existing prior art: store tests already use temporary roots and assert publish/list/claim behavior; Telegram router tests already assert command routing through project aliases; Telegram relay tests already assert severity-based relay filtering.

## Out of Scope

- Cloud or multi-machine gateway networking.
- Replacing project-local approval rules with System Gateway permissions.
- Customer-visible actions from Telegram without Project Agent review.
- Building Slack, Discord, email, or web relay implementations in this PRD.
- Building a full TUI dashboard for the System Gateway.
- Persisting a global source-of-truth inbox that duplicates project message ownership.
- Auto-registering every discovered project without operator approval.

## Further Notes

This PRD follows the glossary in the Pi Gateway context document and the accepted hybrid topology ADR. The main architectural smell to avoid is letting Telegram or any other Relay become the System Gateway by accident. ShitRat is the operator-facing identity of the System Gateway, and Telegram is only one transport into it.
