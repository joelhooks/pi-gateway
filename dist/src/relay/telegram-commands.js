import { Effect } from "effect";
export const defaultTelegramCommands = [
    { command: "gateway", description: "Show default gateway status" },
    { command: "aihero", description: "Activate AI Hero context" },
    { command: "help", description: "Show ShitRat text commands" },
];
export function setTelegramCommands(input) {
    return Effect.tryPromise({
        try: async () => {
            const response = await fetch(`${input.apiBaseUrl ?? "https://api.telegram.org"}/bot${input.token}/setMyCommands`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ commands: input.commands ?? defaultTelegramCommands }),
            });
            if (!response.ok)
                throw new Error(`Telegram setMyCommands failed: ${response.status} ${await response.text()}`);
            return (await response.json());
        },
        catch: (error) => error instanceof Error ? error : new Error(String(error)),
    });
}
