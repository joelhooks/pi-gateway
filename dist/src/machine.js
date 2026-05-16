import { assign, setup } from "xstate";
export const gatewayMachine = setup({
    types: {
        context: {},
        events: {},
        input: {},
    },
    actions: {
        markStarted: assign(({ event }) => {
            if (event.type !== "gateway.start")
                return {};
            return { lastStartedAt: event.at ?? new Date().toISOString(), lastError: undefined };
        }),
        markFailed: assign(({ event }) => {
            if (event.type !== "gateway.fail")
                return {};
            return { lastError: event.error };
        }),
        rememberMessage: assign(({ event }) => {
            if (event.type !== "message.published")
                return {};
            return { lastMessage: event.message };
        }),
    },
}).createMachine({
    id: "pi-gateway",
    initial: "stopped",
    context: ({ input }) => ({ root: input.root }),
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
