export type TelegramRouterProject = {
    id: string;
    root: string;
    aliases?: string[];
    wakeCommand?: string | false;
};
export type TelegramRouterConfig = {
    projects: TelegramRouterProject[];
    defaultProjectId: string;
    stateFile: string;
};
export type TelegramChannel = {
    post: (message: string | {
        markdown?: string;
        text?: string;
    }) => Promise<unknown>;
};
export declare function createTelegramRouter(config: TelegramRouterConfig): {
    handle: (text: string, threadId?: string) => Promise<string | undefined>;
    pollNotifications: (channel: TelegramChannel) => Promise<void>;
    parseCommand: (text: string) => {
        project: string | undefined;
        command: string;
    } | undefined;
};
export declare function defaultRouterConfig(options?: Partial<TelegramRouterConfig>): TelegramRouterConfig;
