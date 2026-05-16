import type { GatewayMessage } from "./schema.js";
export type GatewayMachineContext = {
    root: string;
    lastStartedAt?: string;
    lastError?: string;
    lastMessage?: GatewayMessage;
};
export type GatewayMachineEvent = {
    type: "gateway.start";
    at?: string;
} | {
    type: "gateway.stop";
    at?: string;
} | {
    type: "gateway.fail";
    error: string;
} | {
    type: "message.published";
    message: GatewayMessage;
};
export declare const gatewayMachine: import("xstate").StateMachine<GatewayMachineContext, {
    type: "gateway.start";
    at?: string;
} | {
    type: "gateway.stop";
    at?: string;
} | {
    type: "gateway.fail";
    error: string;
} | {
    type: "message.published";
    message: GatewayMessage;
}, {}, never, {
    type: "markStarted";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "markFailed";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "rememberMessage";
    params: import("xstate").NonReducibleUnknown;
}, never, never, "stopped" | "running" | "degraded", string, {
    root: string;
}, import("xstate").NonReducibleUnknown, import("xstate").EventObject, import("xstate").MetaObject, {
    id: "pi-gateway";
    states: {
        readonly stopped: {};
        readonly running: {};
        readonly degraded: {};
    };
}>;
