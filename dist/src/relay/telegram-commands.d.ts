import { Effect } from "effect";
export type TelegramBotCommand = {
    command: string;
    description: string;
};
export declare const defaultTelegramCommands: TelegramBotCommand[];
export declare function telegramCommandsForProjects(projects: Array<{
    id: string;
}>): TelegramBotCommand[];
export declare function setTelegramCommands(input: {
    token: string;
    commands?: TelegramBotCommand[];
    apiBaseUrl?: string;
}): Effect.Effect<{
    ok: boolean;
    result: boolean;
}, Error, never>;
