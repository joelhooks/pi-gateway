import { Effect } from "effect";

export type TelegramBotCommand = {
  command: string;
  description: string;
};

export const defaultTelegramCommands: TelegramBotCommand[] = [
  { command: "gateway", description: "Show default gateway status" },
  { command: "help", description: "Show ShitRat text commands" },
];

export function telegramCommandsForProjects(projects: Array<{ id: string }>): TelegramBotCommand[] {
  return [
    ...defaultTelegramCommands,
    ...projects
      .filter((project) => /^[a-z][a-z0-9_]{0,31}$/i.test(project.id))
      .map((project) => ({ command: project.id, description: `Activate ${project.id} context` })),
  ];
}

export function setTelegramCommands(input: { token: string; commands?: TelegramBotCommand[]; apiBaseUrl?: string }) {
  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${input.apiBaseUrl ?? "https://api.telegram.org"}/bot${input.token}/setMyCommands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commands: input.commands ?? defaultTelegramCommands }),
      });
      if (!response.ok) throw new Error(`Telegram setMyCommands failed: ${response.status} ${await response.text()}`);
      return (await response.json()) as { ok: boolean; result: boolean };
    },
    catch: (error) => error instanceof Error ? error : new Error(String(error)),
  });
}
