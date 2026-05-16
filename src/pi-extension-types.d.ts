declare module "@earendil-works/pi-coding-agent" {
  export type ExtensionAPI = {
    on: (event: string, handler: (event: unknown, ctx: ExtensionContext) => unknown | Promise<unknown>) => void;
    registerTool: (tool: {
      name: string;
      label?: string;
      description?: string;
      parameters: unknown;
      execute: (
        toolCallId: string,
        params: Record<string, any>,
        signal: AbortSignal,
        onUpdate: unknown,
        ctx: ExtensionContext,
      ) => Promise<{ content: Array<{ type: "text"; text: string }>; details: Record<string, unknown> }>;
    }) => void;
    registerCommand: (name: string, command: { description?: string; handler: (args: string, ctx: ExtensionContext) => unknown | Promise<unknown> }) => void;
  };

  export type ExtensionContext = {
    cwd?: string;
    ui: {
      notify: (message: string, level?: string) => void;
      setStatus: (key: string, value: string) => void;
    };
  };
}
