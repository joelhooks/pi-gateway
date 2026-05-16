import { describe, expect, test, vi } from "vitest";
import { Effect } from "effect";
import { defaultTelegramCommands, setTelegramCommands } from "../src/relay/telegram-commands.js";
describe("telegram commands", () => {
    test("registers default slash commands with Telegram", async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: true }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);
        try {
            await Effect.runPromise(setTelegramCommands({ token: "token", apiBaseUrl: "https://telegram.test" }));
            expect(fetchMock).toHaveBeenCalledWith("https://telegram.test/bottoken/setMyCommands", expect.objectContaining({ method: "POST" }));
            const firstCall = fetchMock.mock.calls[0];
            const body = JSON.parse(firstCall[1].body);
            expect(body.commands).toEqual(defaultTelegramCommands);
        }
        finally {
            vi.unstubAllGlobals();
        }
    });
});
