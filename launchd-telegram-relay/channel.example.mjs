import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createMemoryState } from "@chat-adapter/state-memory";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ask } from "./claw.mjs";
import { analyze } from "./memory.mjs";
import { log } from "./log.mjs";
import { handlePiGatewayMessage, pollPiGatewayNotifications } from "./routes/pi-gateway.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESTART_FILE = join(__dirname, ".claw", "last-start");
const OWNER_CHAT_FILE = join(__dirname, ".claw", "owner-chat-id");

const telegram = createTelegramAdapter({
  mode: "polling",
});

const bot = new Chat({
  userName: "myclaw",
  adapters: { telegram },
  state: createMemoryState(),
  onLockConflict: "force",
});

function checkRestart() {
  const isRestart = existsSync(RESTART_FILE);
  writeFileSync(RESTART_FILE, String(Date.now()));
  return isRestart;
}

async function notifyRestart() {
  if (!existsSync(OWNER_CHAT_FILE)) return;
  const chatId = readFileSync(OWNER_CHAT_FILE, "utf-8").trim();

  try {
    const ch = bot.channel(chatId);
    await ch.post("🐀 I'm back. Restarted and ready.");
  } catch (err) {
    console.error("[restart] Failed to notify:", err.message);
  }
}

async function handleMessage(thread, message) {
  const text = message.text?.trim();
  if (!text) return;

  // Save owner chat ID on first interaction
  if (!existsSync(OWNER_CHAT_FILE)) {
    writeFileSync(OWNER_CHAT_FILE, thread.id);
  }

  console.log(`[${thread.id}] ← ${text.slice(0, 80)}`);

  try {
    const routed = await handlePiGatewayMessage(text, thread.id);
    if (routed) {
      console.log(`[${thread.id}] routed gateway → ${routed.slice(0, 80)}`);
      await thread.post({ markdown: routed });
      return;
    }

    console.log(`[${thread.id}] calling ask...`);
    await thread.startTyping();
    const res = await ask(text, thread.id);
    console.log(`[${thread.id}] → ${res.text.slice(0, 80)}`);
    await thread.post({ markdown: res.text });
    console.log(`[${thread.id}] posted`);
  } catch (err) {
    console.error(`[${thread.id}] Error:`, err.message?.slice(0, 200));
    try { await thread.post("Something went wrong. Check the logs."); } catch {}
  }
}

bot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  await handleMessage(thread, message);
});

bot.onSubscribedMessage(async (thread, message) => {
  await handleMessage(thread, message);
});

const MEMORY_INTERVAL_MS = 10 * 60 * 1000;
const GATEWAY_NOTIFICATION_INTERVAL_MS = 60 * 1000;

async function memoryTick() {
  try {
    const updated = await analyze();
    if (updated) console.log("[memory] Memories refreshed");
  } catch (err) {
    console.error("[memory] Tick error:", err.message?.slice(0, 100));
  }
}

async function gatewayNotificationTick() {
  if (!existsSync(OWNER_CHAT_FILE)) return;
  const chatId = readFileSync(OWNER_CHAT_FILE, "utf-8").trim();
  if (!chatId) return;

  try {
    await pollPiGatewayNotifications(bot.channel(chatId));
  } catch (err) {
    console.error("[pi-gateway] Tick error:", err.message?.slice(0, 160));
  }
}

setInterval(memoryTick, MEMORY_INTERVAL_MS);
setTimeout(memoryTick, 30000); // catch up shortly after startup
setInterval(gatewayNotificationTick, GATEWAY_NOTIFICATION_INTERVAL_MS);
setTimeout(gatewayNotificationTick, 10000);

await bot.initialize();

const wasRestart = checkRestart();
log("boot", { event: wasRestart ? "restart" : "first_start", adapter: "telegram" });
if (wasRestart) {
  setTimeout(() => notifyRestart(), 5000);
}

console.log("Claw listening on Telegram (polling mode)");
