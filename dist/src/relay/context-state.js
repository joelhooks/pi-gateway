import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
export function defaultTelegramContextState() {
    return { seenMessageIds: [], threads: {} };
}
export function readTelegramContextState(file) {
    try {
        const parsed = JSON.parse(readFileSync(file, "utf8"));
        return { seenMessageIds: parsed.seenMessageIds ?? [], threads: parsed.threads ?? {} };
    }
    catch {
        return defaultTelegramContextState();
    }
}
export function saveTelegramContextState(file, state) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}
