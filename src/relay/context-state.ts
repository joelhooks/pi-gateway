import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type TelegramThreadContext = {
  projectId?: string;
  attachedAgentId?: string;
  updatedAt: string;
};

export type TelegramContextState = {
  seenMessageIds: string[];
  threads: Record<string, TelegramThreadContext>;
};

export function defaultTelegramContextState(): TelegramContextState {
  return { seenMessageIds: [], threads: {} };
}

export function readTelegramContextState(file: string): TelegramContextState {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return { seenMessageIds: parsed.seenMessageIds ?? [], threads: parsed.threads ?? {} };
  } catch {
    return defaultTelegramContextState();
  }
}

export function saveTelegramContextState(file: string, state: TelegramContextState) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}
