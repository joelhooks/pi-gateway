import { Schema } from "effect";

export const GatewaySeverity = Schema.Literal("info", "warn", "error");
export type GatewaySeverity = typeof GatewaySeverity.Type;

export const GatewayMessageStatus = Schema.Literal("new", "seen", "claimed", "resolved", "expired");
export type GatewayMessageStatus = typeof GatewayMessageStatus.Type;

export const GatewayChannelKind = Schema.Literal("local", "telegram");
export type GatewayChannelKind = typeof GatewayChannelKind.Type;

export class GatewayChannel extends Schema.Class<GatewayChannel>("GatewayChannel")({
  id: Schema.String,
  kind: GatewayChannelKind,
  enabled: Schema.Boolean,
  chatId: Schema.optional(Schema.String),
  minSeverity: Schema.optional(GatewaySeverity),
  routePattern: Schema.optional(Schema.String),
}) {}

export class GatewayConfig extends Schema.Class<GatewayConfig>("GatewayConfig")({
  schemaVersion: Schema.Literal(1),
  channels: Schema.Array(GatewayChannel),
  relay: Schema.optional(Schema.Struct({
    pollIntervalMs: Schema.optional(Schema.Number),
    importantPattern: Schema.optional(Schema.String),
  })),
}) {}

export class GatewayReceipt extends Schema.Class<GatewayReceipt>("GatewayReceipt")({
  at: Schema.String,
  event: Schema.String,
  note: Schema.optional(Schema.String),
}) {}

export class GatewayMessage extends Schema.Class<GatewayMessage>("GatewayMessage")({
  id: Schema.String,
  channel: Schema.String,
  from: Schema.String,
  to: Schema.optional(Schema.String),
  title: Schema.String,
  body: Schema.optional(Schema.String),
  severity: GatewaySeverity,
  status: GatewayMessageStatus,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  claimedBy: Schema.optional(Schema.String),
  claimedAt: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  receipts: Schema.Array(GatewayReceipt),
}) {}

export class GatewayAgentHeartbeat extends Schema.Class<GatewayAgentHeartbeat>("GatewayAgentHeartbeat")({
  id: Schema.String,
  name: Schema.String,
  cwd: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  lastSeenAt: Schema.String,
}) {}

export class GatewayState extends Schema.Class<GatewayState>("GatewayState")({
  schemaVersion: Schema.Literal(1),
  updatedAt: Schema.String,
  messages: Schema.Array(GatewayMessage),
  agents: Schema.Array(GatewayAgentHeartbeat),
}) {}
