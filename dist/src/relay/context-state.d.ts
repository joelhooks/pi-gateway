export type TelegramThreadContext = {
    projectId?: string;
    attachedAgentId?: string;
    updatedAt: string;
};
export type TelegramContextState = {
    seenMessageIds: string[];
    threads: Record<string, TelegramThreadContext>;
};
export declare function defaultTelegramContextState(): TelegramContextState;
export declare function readTelegramContextState(file: string): TelegramContextState;
export declare function saveTelegramContextState(file: string, state: TelegramContextState): void;
