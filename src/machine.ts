import { assign, setup } from "xstate";
import type { GatewayMessage } from "./schema.js";

export type GatewayMachineContext = {
  root: string;
  lastStartedAt?: string;
  lastError?: string;
  lastMessage?: GatewayMessage;
};

export type GatewayMachineEvent =
  | { type: "gateway.start"; at?: string }
  | { type: "gateway.stop"; at?: string }
  | { type: "gateway.fail"; error: string }
  | { type: "message.published"; message: GatewayMessage };

export const gatewayMachine = setup({
  types: {
    context: {} as GatewayMachineContext,
    events: {} as GatewayMachineEvent,
    input: {} as { root: string },
  },
  actions: {
    markStarted: assign(({ event }) => {
      if (event.type !== "gateway.start") return {};
      return { lastStartedAt: event.at ?? new Date().toISOString(), lastError: undefined };
    }),
    markFailed: assign(({ event }) => {
      if (event.type !== "gateway.fail") return {};
      return { lastError: event.error };
    }),
    rememberMessage: assign(({ event }) => {
      if (event.type !== "message.published") return {};
      return { lastMessage: event.message };
    }),
  },
}).createMachine({
  id: "pi-gateway",
  initial: "stopped",
  context: ({ input }: { input: { root: string } }) => ({ root: input.root }),
  states: {
    stopped: {
      tags: ["idle"],
      on: { "gateway.start": { target: "running", actions: ["markStarted"] } },
    },
    running: {
      tags: ["healthy"],
      on: {
        "message.published": { actions: ["rememberMessage"] },
        "gateway.fail": { target: "degraded", actions: ["markFailed"] },
        "gateway.stop": { target: "stopped" },
      },
    },
    degraded: {
      tags: ["error"],
      on: {
        "gateway.start": { target: "running", actions: ["markStarted"] },
        "gateway.stop": { target: "stopped" },
      },
    },
  },
});
